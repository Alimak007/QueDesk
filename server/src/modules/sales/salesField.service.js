import { SYSTEM_SALES_FIELDS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_SALES_FIELDS } from './defaultFields.js';
import { Lead } from './lead.model.js';
import { coerceFieldValue } from './leadData.js';
import { SalesField } from './salesField.model.js';
import { getSalesSettings } from './salesSettings.model.js';

const SYSTEM_KEYS = new Set(Object.values(SYSTEM_SALES_FIELDS));

/** Creates the initial Sales form when the collection is empty. Safe to call on every boot. */
export async function ensureDefaultSalesFields() {
  if (await SalesField.estimatedDocumentCount()) return;
  await SalesField.insertMany(DEFAULT_SALES_FIELDS.map((f, index) => ({ ...f, order: index })));
  await getSalesSettings();
  logger.info('Default Sales form fields created');
}

export async function listFields({ includeArchived = false } = {}) {
  const filter = includeArchived ? {} : { isArchived: false };
  return SalesField.find(filter).sort({ isArchived: 1, order: 1, createdAt: 1 });
}

export async function listActiveFields() {
  return SalesField.find({ isArchived: false }).sort({ order: 1 }).lean();
}

async function getField(id) {
  const field = await SalesField.findById(id);
  if (!field) throw ApiError.notFound('Sales field not found');
  return field;
}

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

async function uniqueKey(base) {
  let key = base;
  for (let i = 2; await SalesField.exists({ key }); i += 1) key = `${base}${i}`;
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

export async function createField(data) {
  const key = data.key
    ? data.key
    : await uniqueKey(toCamelKey(data.label));

  if (data.key && (await SalesField.exists({ key }))) {
    throw ApiError.conflict('A field with this key already exists', {
      details: [{ path: 'key', message: 'This key is already in use' }],
    });
  }

  const last = await SalesField.findOne().sort({ order: -1 }).select('order').lean();
  const field = new SalesField({
    ...data,
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

  if (field.isSystem) {
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
  if (field.isSystem && isArchived) throw ApiError.conflict('System fields cannot be archived');
  if (isArchived) await assertNotReferencedBySettings(field, 'archive');

  field.isArchived = isArchived;
  if (!isArchived) {
    const last = await SalesField.findOne({ isArchived: false }).sort({ order: -1 }).select('order').lean();
    field.order = (last?.order ?? -1) + 1;
  }
  await field.save();
  return field;
}

/** Permanent deletion is only allowed for fields that hold no lead data. */
export async function deleteField(id) {
  const field = await getField(id);
  if (field.isSystem || SYSTEM_KEYS.has(field.key)) throw ApiError.conflict('System fields cannot be deleted');
  await assertNotReferencedBySettings(field, 'delete');

  const inUse = await Lead.exists({ [`data.${field.key}`]: { $nin: [null, '', false] } });
  if (inUse) {
    throw ApiError.conflict('This field already contains lead data. Archive it instead to preserve history.', {
      code: 'FIELD_IN_USE',
    });
  }
  await field.deleteOne();
}

export async function reorderFields(ids) {
  const fields = await SalesField.find({ _id: { $in: ids } }).select('_id').lean();
  if (fields.length !== new Set(ids).size) throw ApiError.badRequest('One or more fields were not found');

  await SalesField.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
  );
  return listFields({ includeArchived: true });
}

export async function updateSettings(data, actor) {
  const settings = await getSalesSettings();

  if (data.kanbanGroupField) {
    const field = await SalesField.findOne({ key: data.kanbanGroupField, isArchived: false }).lean();
    if (!field || field.type !== 'dropdown') {
      throw ApiError.badRequest('The Kanban grouping field must be an active dropdown field');
    }
  }
  if (data.valueField) {
    const field = await SalesField.findOne({ key: data.valueField, isArchived: false }).lean();
    if (!field || !['number', 'currency'].includes(field.type)) {
      throw ApiError.badRequest('The value field must be an active number or currency field');
    }
  }

  Object.assign(settings, data, { updatedBy: actor._id });
  await settings.save();
  return settings;
}
