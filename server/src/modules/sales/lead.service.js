import { USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPage, escapeRegex, getPagination } from '../../utils/pagination.js';
import { User } from '../users/user.model.js';
import { Lead } from './lead.model.js';
import { buildSearchText, validateRecordData } from './recordData.js';
import { listActiveFields } from './salesField.service.js';
import { getSalesSettings } from './salesSettings.model.js';

const BOARD_LIMIT = 1000;

const POPULATE = [
  { path: 'owner', select: 'firstName lastName designation department' },
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'updatedBy', select: 'firstName lastName' },
  { path: 'customer', select: 'data.customerName' },
];

async function assertValidOwner(ownerId) {
  const owner = await User.exists({ _id: ownerId, status: USER_STATUS.ACTIVE });
  if (!owner) {
    throw ApiError.badRequest('Selected owner is not an active employee', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'owner', message: 'Select an active employee' }],
    });
  }
}

/**
 * A converted lead has left the pipeline: it keeps its place in the list as a
 * record of where the customer came from, but never appears on the board again.
 */
const ACTIVE = { customer: null };
const CONVERTED = { customer: { $ne: null } };

function buildFilter({ search, owner, group, state }, settings) {
  const filter = {};
  if (owner) filter.owner = owner;
  if (group) filter[`data.${settings.kanbanGroupField}`] = group === '__none__' ? null : group;
  if (search) filter.searchText = new RegExp(escapeRegex(search.toLowerCase()));
  if (state === 'active') Object.assign(filter, ACTIVE);
  if (state === 'converted') Object.assign(filter, CONVERTED);
  return filter;
}

/** Sales records are shared: every authenticated user can list every lead. */
export async function listLeads(query) {
  const settings = await getSalesSettings();
  const filter = buildFilter(query, settings);
  const { page, limit, skip } = getPagination(query);
  const sort = { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1, _id: -1 };

  const [items, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Lead.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}

export async function getBoard(query) {
  const [settings, fields] = await Promise.all([getSalesSettings(), listActiveFields()]);
  const groupField = fields.find((f) => f.key === settings.kanbanGroupField);
  if (!groupField) throw ApiError.conflict('The Kanban grouping field is not configured. Ask an admin to set it.');

  const filter = { ...buildFilter(query, settings), ...ACTIVE };
  const leads = await Lead.find(filter)
    .sort({ position: 1, updatedAt: -1 })
    .limit(BOARD_LIMIT)
    .populate(POPULATE);

  const valueKey = settings.valueField;
  const known = new Set(groupField.options.map((o) => o.value));
  const columns = [
    ...groupField.options.map((o) => ({ ...o, leadIds: [], total: 0 })),
    { value: null, label: 'Uncategorised', color: 'slate', leadIds: [], total: 0 },
  ];
  const byValue = new Map(columns.map((c) => [c.value, c]));

  for (const lead of leads) {
    const raw = lead.data?.[groupField.key];
    const column = byValue.get(known.has(raw) ? raw : null);
    column.leadIds.push(lead.id);
    if (valueKey && typeof lead.data?.[valueKey] === 'number') column.total += lead.data[valueKey];
  }

  return {
    groupField: groupField.key,
    columns: columns.filter((c) => c.value !== null || c.leadIds.length > 0),
    leads,
    truncated: leads.length === BOARD_LIMIT,
  };
}

export async function getLead(id) {
  const lead = await Lead.findById(id).populate(POPULATE);
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

export async function createLead({ data, owner }, actor) {
  const fields = await listActiveFields();
  const ownerId = owner ?? actor._id;
  if (owner) await assertValidOwner(owner);

  const values = validateRecordData(data, fields);
  const lead = await Lead.create({
    data: values,
    owner: ownerId,
    createdBy: actor._id,
    searchText: buildSearchText(values, fields),
    // Newest leads appear at the top of their Kanban column.
    position: -Date.now(),
  });
  return lead.populate(POPULATE);
}

export async function updateLead(id, { data, owner, position }, actor) {
  const lead = await Lead.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found');

  // A converted lead is a historical record; the customer is the live one now.
  if (lead.customer) {
    throw ApiError.conflict('This lead has been converted to a customer. Edit the customer record instead.', {
      code: 'LEAD_CONVERTED',
    });
  }

  const fields = await listActiveFields();
  if (data) {
    lead.data = validateRecordData(data, fields, { existing: lead.data ?? {} });
    lead.searchText = buildSearchText(lead.data, fields);
    lead.markModified('data');
  }
  if (owner && owner !== lead.owner.toString()) {
    await assertValidOwner(owner);
    lead.owner = owner;
  }
  if (position !== undefined) lead.position = position;
  lead.updatedBy = actor._id;
  await lead.save();

  return lead.populate(POPULATE);
}

/** Kanban drag & drop: changes the grouping value and/or position of a card. */
export async function moveLead(id, { value, position }, actor) {
  const settings = await getSalesSettings();
  return updateLead(id, { data: { [settings.kanbanGroupField]: value }, position }, actor);
}


export async function deleteLead(id) {
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) throw ApiError.notFound('Lead not found');
  // Keep any converted customer, it simply loses its origin reference.
  if (lead.customer) {
    const { Customer } = await import('../customers/customer.model.js');
    await Customer.updateOne({ _id: lead.customer }, { $set: { lead: null } });
  }
}

export async function getSalesSummary({ owner } = {}) {
  const [settings, fields] = await Promise.all([getSalesSettings(), listActiveFields()]);
  const groupKey = settings.kanbanGroupField;
  const valueKey = settings.valueField;
  const groupField = fields.find((f) => f.key === groupKey);

  const match = owner ? { owner, ...ACTIVE } : { ...ACTIVE };
  const [rows, total] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: `$data.${groupKey}`,
          count: { $sum: 1 },
          value: valueKey ? { $sum: { $ifNull: [`$data.${valueKey}`, 0] } } : { $sum: 0 },
        },
      },
    ]),
    Lead.countDocuments(match),
  ]);

  const byValue = new Map(rows.map((r) => [r._id, r]));
  const stages = (groupField?.options ?? []).map((o) => ({
    value: o.value,
    label: o.label,
    color: o.color,
    count: byValue.get(o.value)?.count ?? 0,
    total: byValue.get(o.value)?.value ?? 0,
  }));

  return {
    totalLeads: total,
    totalValue: rows.reduce((sum, r) => sum + (r.value || 0), 0),
    currency: settings.currency,
    valueField: valueKey,
    stages,
  };
}

export async function listRecentLeads(limit = 5) {
  return Lead.find().sort({ createdAt: -1 }).limit(limit).populate(POPULATE);
}
