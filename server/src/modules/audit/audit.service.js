import { buildPage, getPagination } from '../../utils/pagination.js';
import { logger } from '../../utils/logger.js';
import { AuditLog } from './audit.model.js';

/**
 * Records an audit entry. Auditing is a side effect: a failure is logged but
 * never fails the business operation that triggered it.
 */
export async function audit(actor, action, entityType, entityId, summary = '', meta = null) {
  try {
    await AuditLog.create({ actor: actor?._id ?? null, action, entityType, entityId: entityId ?? null, summary, meta });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}

export async function listAuditLogs(query) {
  const filter = {};
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.actor) filter.actor = query.actor;

  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'firstName lastName email'),
    AuditLog.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}
