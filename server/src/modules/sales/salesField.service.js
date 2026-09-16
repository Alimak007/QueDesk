import mongoose from 'mongoose';
import { SYSTEM_FIELD_KEYS, SYSTEM_SALES_FIELDS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_FIELDS } from './defaultFields.js';
import { coerceFieldValue } from './recordData.js';
import { SalesField } from './salesField.model.js';
import { getSalesSettings } from './salesSettings.model.js';

/** Model that stores records for an entity; resolved lazily to avoid circular imports. */
const RECORD_MODEL = { lead: 'Lead', customer: 'Customer' };
const recordModel = (entity) => mongoose.model(RECORD_MODEL[entity]);

/** Creates the initial forms for any entity that has no fields yet. Safe to call on every boot. */
export async function ensureDefaultFields() {
  for (const [entity, fields] of Object.entries(DEFAULT_FIELDS)) {
    if (await SalesField.exists({ entity })) continue;
    await SalesField.insertMany(fields.map((f, index) => ({ ...f, entity, order: index })));
    logger.info({ entity }, 'Default form fields created');
  }
  await getSalesSettings();
}

/** @deprecated Use ensureDefaultFields. */
export const ensureDefaultSalesFields = ensureDefaultFields;

export async function listFields({ entity = 'lead', includeArchived = false } = {}) {
  const filter = { entity, ...(includeArchived ? {} : { isArchived: false }) };
  return SalesField.find(filter).sort({ isArchived: 1, order: 1, createdAt: 1 });
}

export async function listActiveFields(entity = 'lead') {
  return SalesField.find({ entity, isArchived: false }).sort({ order: 1 }).lean();
}

async function getField(id) {
  const field = await SalesField.findById(id);
  if (!field) throw ApiError.notFound('Field not found');
  return field;
}

const isSystemKey = (field) => field.isSystem || SYSTEM_FIELD_KEYS[field.entity]?.includes(field.key);

function toCamelKey(label) {
  const words = label
    .normalize('NFKD')
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
    .replace(/^[^a-z]+/, '');
  return (key || 'field').slice(0, 32);
}

async function uniqueKey(entity, base) {
  let key = base;
  for (let i = 2; await SalesField.exists({ entity, key }); i += 1) key = `${base}${i}`;
  return key;
}

function assertDefaultValueValid(field) {
  if (field.defaultValue === null || field.defaultValue === undefined || field.defaultValue === '') return;
  const { error } = coerceFieldValue(field, field.defaultValue);
  if (error) {
    throw ApiError.badRequest(`Default value is invalid: ${error}`, {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'defaultValue', message: error }],
    });
  }
}

export async function createField({ entity = 'lead', ...data }) {
  const key = data.key ? data.key : await uniqueKey(entity, toCamelKey(data.label));

  if (data.key && (await SalesField.exists({ entity, key }))) {
    throw ApiError.conflict('A field with this key already exists', {
      details: [{ path: 'key', message: 'This key is already in use' }],
    });
  }

  const last = await SalesField.findOne({ entity }).sort({ order: -1 }).select('order').lean();
  const field = new SalesField({
    ...data,
    entity,
    key,
    options: data.type === 'dropdown' ? data.options : [],
    order: (last?.order ?? -1) + 1,
  });
  assertDefaultValueValid(field);
  await field.save();
  return field;
}

export async function updateField(id, data) {
  const field = await getField(id);

  if (isSystemKey(field)) {
    if (data.isVisible === false) throw ApiError.conflict(`"${field.label}" is a system field and must stay visible`);
    if (data.required === false) throw ApiError.conflict(`"${field.label}" is a system field and must stay required`);
  }
  if (data.options && field.type !== 'dropdown') delete data.options;
  if (field.type === 'dropdown' && data.options && data.options.length === 0) {
    throw ApiError.badRequest('Dropdown fields need at least one option');
  }

  Object.assign(field, data);
  assertDefaultValueValid(field);
  await field.save();
  return field;
}

async function assertNotReferencedBySettings(field, action) {
  if (field.entity !== 'lead') return;
  const settings = await getSalesSettings();
  if (settings.kanbanGroupField === field.key) {
    throw ApiError.conflict(`"${field.label}" is used to group the Kanban board. Choose another grouping field before you ${action} it.`);
  }
  if (settings.valueField === field.key) {
    throw ApiError.conflict(`"${field.label}" is used as the pipeline value field. Change it in settings before you ${action} it.`);
  }
}

export async function setArchived(id, isArchived) {
  const field = await getField(id);
  if (isSystemKey(field) && isArchived) throw ApiError.conflict('System fields cannot be archived');
  if (isArchived) await assertNotReferencedBySettings(field, 'archive');

  field.isArchived = isArchived;
  if (!isArchived) {
    const last = await SalesField.findOne({ entity: field.entity, isArchived: false }).sort({ order: -1 }).select('order').lean();
    field.order = (last?.order ?? -1) + 1;
  }
  await field.save();
  return field;
}

/** Permanent deletion is only allowed for fields that hold no record data. */
export async function deleteField(id) {
  const field = await getField(id);
  if (isSystemKey(field)) throw ApiError.conflict('System fields cannot be deleted');
  await assertNotReferencedBySettings(field, 'delete');

  const inUse = await recordModel(field.entity).exists({ [`data.${field.key}`]: { $nin: [null, '', false] } });
  if (inUse) {
    throw ApiError.conflict('This field already contains data. Archive it instead to preserve history.', {
      code: 'FIELD_IN_USE',
    });
  }
  await field.deleteOne();
}

export async function reorderFields(entity, ids) {
  const fields = await SalesField.find({ _id: { $in: ids }, entity }).select('_id').lean();
  if (fields.length !== new Set(ids).size) throw ApiError.badRequest('One or more fields were not found');

  await SalesField.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
  );
  return listFields({ entity, includeArchived: true });
}

export async function updateSettings(data, actor) {
  const settings = await getSalesSettings();

  if (data.kanbanGroupField) {
    const field = await SalesField.findOne({ entity: 'lead', key: data.kanbanGroupField, isArchived: false }).lean();
    if (!field || field.type !== 'dropdown') {
      throw ApiError.badRequest('The Kanban grouping field must be an active dropdown field');
    }
  }
  if (data.valueField) {
    const field = await SalesField.findOne({ entity: 'lead', key: data.valueField, isArchived: false }).lean();
    if (!field || !['number', 'currency'].includes(field.type)) {
      throw ApiError.badRequest('The value field must be an active number or currency field');
    }
  }

  Object.assign(settings, data, { updatedBy: actor._id });
  await settings.save();
  return settings;
}
