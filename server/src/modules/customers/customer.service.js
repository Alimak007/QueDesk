import { SYSTEM_CUSTOMER_FIELDS, SYSTEM_SALES_FIELDS, USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPage, escapeRegex, getPagination } from '../../utils/pagination.js';
import { audit } from '../audit/audit.service.js';
import { Lead } from '../sales/lead.model.js';
import { buildSearchText, validateRecordData } from '../sales/recordData.js';
import { listActiveFields } from '../sales/salesField.service.js';
import { User } from '../users/user.model.js';
import { Customer } from './customer.model.js';

const POPULATE = [
  { path: 'owner', select: 'firstName lastName designation department' },
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'updatedBy', select: 'firstName lastName' },
  { path: 'convertedBy', select: 'firstName lastName' },
  { path: 'lead', select: 'data.leadName data.leadStatus createdAt' },
];

const titleOf = (customer) => customer?.data?.[SYSTEM_CUSTOMER_FIELDS.TITLE] || 'Customer';

async function assertValidOwner(ownerId) {
  if (!(await User.exists({ _id: ownerId, status: USER_STATUS.ACTIVE }))) {
    throw ApiError.badRequest('Selected owner is not an active employee', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'owner', message: 'Select an active employee' }],
    });
  }
}

export async function listCustomers(query) {
  const { search, owner, status, source, sortBy, sortOrder } = query;
  const filter = {};
  if (owner) filter.owner = owner;
  if (source) filter.source = source;
  if (status) filter[`data.${SYSTEM_CUSTOMER_FIELDS.STATUS}`] = status;
  if (search) filter.searchText = new RegExp(escapeRegex(search.toLowerCase()));

  const { page, limit, skip } = getPagination(query);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: -1 };
  const [items, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Customer.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}

export async function getCustomer(id) {
  const customer = await Customer.findById(id).populate(POPULATE);
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
}

export async function createCustomer({ data, owner }, actor) {
  const fields = await listActiveFields('customer');
  if (owner) await assertValidOwner(owner);
  const values = validateRecordData(data, fields);

  const customer = await Customer.create({
    data: values,
    owner: owner ?? actor._id,
    createdBy: actor._id,
    source: 'manual',
    searchText: buildSearchText(values, fields),
  });
  await audit(actor, 'customer.created', 'customer', customer._id, `Created customer “${titleOf(customer)}”`);
  return customer.populate(POPULATE);
}

export async function updateCustomer(id, { data, owner }, actor) {
  const customer = await Customer.findById(id);
  if (!customer) throw ApiError.notFound('Customer not found');

  const fields = await listActiveFields('customer');
  if (data) {
    customer.data = validateRecordData(data, fields, { existing: customer.data ?? {} });
    customer.searchText = buildSearchText(customer.data, fields);
    customer.markModified('data');
  }
  if (owner && owner !== customer.owner.toString()) {
    await assertValidOwner(owner);
    customer.owner = owner;
  }
  customer.updatedBy = actor._id;
  await customer.save();
  await audit(actor, 'customer.updated', 'customer', customer._id, `Updated customer “${titleOf(customer)}”`);
  return customer.populate(POPULATE);
}

export async function deleteCustomer(id, actor) {
  const customer = await Customer.findById(id);
  if (!customer) throw ApiError.notFound('Customer not found');

  const { Invoice } = await import('../invoices/invoice.model.js');
  if (await Invoice.exists({ customer: customer._id })) {
    throw ApiError.conflict('This customer has invoices. Delete or reassign those invoices first.', { code: 'HAS_INVOICES' });
  }

  await customer.deleteOne();
  // The lead stays; it simply becomes convertible again.
  if (customer.lead) await Lead.updateOne({ _id: customer.lead }, { $set: { customer: null, convertedAt: null } });
  await audit(actor, 'customer.deleted', 'customer', customer._id, `Deleted customer “${titleOf(customer)}”`);
}

/**
 * Builds customer values from a lead: the lead title becomes the customer
 * name, fields that share a key are copied, everything else uses defaults.
 */
function mapLeadToCustomerData(lead, customerFields) {
  const source = lead.data ?? {};
  const data = {};
  for (const field of customerFields) {
    if (field.key === SYSTEM_CUSTOMER_FIELDS.TITLE) {
      data[field.key] = source[SYSTEM_SALES_FIELDS.TITLE] ?? source.company ?? null;
    } else if (field.key === SYSTEM_CUSTOMER_FIELDS.STATUS) {
      continue; // defaults apply
    } else if (source[field.key] !== undefined && source[field.key] !== null) {
      data[field.key] = source[field.key];
    }
  }
  return data;
}

/**
 * Converts a lead into a customer. Idempotent: converting the same lead again
 * returns the existing customer (`created: false`) instead of creating another.
 */
export async function convertLeadToCustomer(leadId, actor) {
  const lead = await Lead.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found');

  const existingId = lead.customer ?? (await Customer.findOne({ lead: lead._id }).select('_id').lean())?._id;
  if (existingId) {
    const existing = await Customer.findById(existingId).populate(POPULATE);
    if (existing) {
      if (!lead.customer) await Lead.updateOne({ _id: lead._id }, { $set: { customer: existing._id } });
      return { customer: existing, created: false };
    }
  }

  const fields = await listActiveFields('customer');
  // Required customer-only fields may not exist on the lead yet; they can be completed after conversion.
  const values = validateRecordData(mapLeadToCustomerData(lead, fields), fields, { skipRequired: true });

  let customer;
  try {
    customer = await Customer.create({
      data: values,
      owner: lead.owner,
      source: 'lead',
      lead: lead._id,
      convertedAt: new Date(),
      convertedBy: actor._id,
      createdBy: actor._id,
      searchText: buildSearchText(values, fields),
    });
  } catch (err) {
    // Two simultaneous conversions: the unique index lets exactly one win.
    if (err?.code === 11000) {
      const winner = await Customer.findOne({ lead: lead._id }).populate(POPULATE);
      if (winner) return { customer: winner, created: false };
    }
    throw err;
  }

  // The lead keeps its stage and its details; it simply leaves the active pipeline.
  await Lead.updateOne(
    { _id: lead._id },
    { $set: { customer: customer._id, convertedAt: customer.convertedAt, updatedBy: actor._id } },
  );

  await audit(actor, 'customer.converted', 'customer', customer._id, `Converted lead “${lead.data?.[SYSTEM_SALES_FIELDS.TITLE] ?? ''}” into a customer`, {
    lead: lead._id,
  });
  return { customer: await customer.populate(POPULATE), created: true };
}

/** Minimal customer list for pickers (e.g. invoices). */
export async function listCustomerOptions() {
  const customers = await Customer.find().sort({ updatedAt: -1 }).limit(1000).lean();
  return customers.map((c) => ({
    id: c._id.toString(),
    name: c.data?.[SYSTEM_CUSTOMER_FIELDS.TITLE] ?? 'Customer',
    company: c.data?.company ?? '',
    email: c.data?.email ?? '',
    billingAddress: c.data?.billingAddress ?? '',
    taxNumber: c.data?.taxNumber ?? '',
  }));
}
