import mongoose from 'mongoose';
import { CUSTOMER_STAGE_VALUE, SYSTEM_SALES_FIELDS } from '../constants/index.js';
import { logger } from '../utils/logger.js';
import { Asset } from '../modules/companies/asset.model.js';
import { Company } from '../modules/companies/company.model.js';
import { AUDIT_RETENTION_DAYS, AuditLog } from '../modules/audit/audit.model.js';
import { SalesField } from '../modules/sales/salesField.model.js';
import { ensureDefaultFields } from '../modules/sales/salesField.service.js';
import { SalesSettings } from '../modules/sales/salesSettings.model.js';

/**
 * Small, idempotent schema/data migrations run at boot. Each one is safe to
 * repeat and must never destroy existing data.
 */
export async function runMigrations() {
  await backfillFieldEntity();
  await ensureDefaultFields();
  await retireCustomerStage();
  await describeCompanyImages();
  await ensureAuditRetention();
}

/** Fields predate the Customer form: tag them as lead fields and widen the unique index. */
async function backfillFieldEntity() {
  const result = await SalesField.collection.updateMany(
    { entity: { $exists: false } },
    { $set: { entity: 'lead' } },
  );
  if (result.modifiedCount) logger.info({ count: result.modifiedCount }, 'Tagged existing form fields as lead fields');

  // The old single-key unique index would block a customer field reusing a lead key.
  const indexes = await SalesField.collection.indexes().catch(() => []);
  if (indexes.some((i) => i.name === 'key_1')) {
    await SalesField.collection.dropIndex('key_1');
    logger.info('Dropped legacy salesfields key_1 index');
  }
  await SalesField.syncIndexes().catch((err) => logger.warn({ err }, 'Could not sync salesfields indexes'));
}

/**
 * Conversion used to happen by dragging a lead into a “Customer” column.
 * It is an explicit action now, so that column is removed: a converted lead is
 * recognised by its `customer` link and simply leaves the board.
 */
async function retireCustomerStage() {
  const status = await SalesField.findOne({ entity: 'lead', key: SYSTEM_SALES_FIELDS.STATUS });
  if (status?.options.some((o) => o.value === CUSTOMER_STAGE_VALUE)) {
    status.options = status.options.filter((o) => o.value !== CUSTOMER_STAGE_VALUE);
    await status.save();
    logger.info('Removed the “Customer” column from Lead Status');
  }

  // Leads parked in that stage keep everything else; only the dead value goes.
  const { Lead } = await import('../modules/sales/lead.model.js');
  const stranded = await Lead.updateMany(
    { [`data.${SYSTEM_SALES_FIELDS.STATUS}`]: CUSTOMER_STAGE_VALUE },
    { $set: { [`data.${SYSTEM_SALES_FIELDS.STATUS}`]: null } },
  );
  if (stranded.modifiedCount) logger.info({ count: stranded.modifiedCount }, 'Cleared the retired customer stage from leads');

  await SalesSettings.updateOne({ _id: 'default' }, { $unset: { customerStage: '' } });
}

/** Drops every model index that is no longer declared (used by tests on a fresh database). */
export async function syncAllIndexes() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes().catch(() => {})));
}

/**
 * Logos and signatures used to be a plain reference to an Asset row. They are
 * now self-describing, so the storage backend (Cloudinary or the database) can
 * be read straight off the company.
 */
async function describeCompanyImages() {
  const legacy = await Company.collection
    .find({ $or: [{ logo: { $type: 'objectId' } }, { signature: { $type: 'objectId' } }] })
    .toArray();
  if (!legacy.length) return;

  for (const company of legacy) {
    const update = {};
    for (const kind of ['logo', 'signature']) {
      const id = company[kind];
      if (!id || typeof id !== 'object' || !id._bsontype) continue;
      const asset = await Asset.findById(id);
      update[kind] = asset
        ? {
            provider: 'database',
            assetId: asset._id,
            format: asset.mimeType === 'image/jpeg' ? 'jpeg' : 'png',
            mimeType: asset.mimeType,
            bytes: asset.size,
            uploadedAt: asset.createdAt ?? new Date(),
          }
        : null;
    }
    await Company.collection.updateOne({ _id: company._id }, { $set: update });
  }
  logger.info({ count: legacy.length }, 'Converted company images to the new storage format');
}

/**
 * The activity log is capped at one month. Creating the TTL index explicitly
 * (rather than relying on autoIndex) means retention still applies wherever
 * automatic indexing is turned off.
 */
async function ensureAuditRetention() {
  const seconds = AUDIT_RETENTION_DAYS * 24 * 60 * 60;
  const indexes = await AuditLog.collection.indexes().catch(() => []);
  const existing = indexes.find((i) => i.name === 'createdAt_1');

  if (existing && existing.expireAfterSeconds !== seconds) {
    await AuditLog.collection.dropIndex('createdAt_1');
    logger.info('Replacing the activity log retention index');
  }
  if (!existing || existing.expireAfterSeconds !== seconds) {
    await AuditLog.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: seconds });
    logger.info({ days: AUDIT_RETENTION_DAYS }, 'Activity log retention set');
  }
}
