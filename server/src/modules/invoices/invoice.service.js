import { ApiError } from '../../utils/ApiError.js';
import { buildPage, escapeRegex, getPagination } from '../../utils/pagination.js';
import { audit } from '../audit/audit.service.js';
import { Company } from '../companies/company.model.js';
import { companySnapshot, nextInvoiceNumber } from '../companies/company.service.js';
import { Customer } from '../customers/customer.model.js';
import { round2 } from '../documents/money.js';
import { Invoice } from './invoice.model.js';

const POPULATE = [
  { path: 'company', select: 'name shortName currency invoice logo signature' },
  { path: 'customer', select: 'data.customerName data.company' },
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'updatedBy', select: 'firstName lastName' },
];

/**
 * Recomputes every monetary field from the line items. The browser's numbers
 * are never trusted: totals, tax and the balance are derived here.
 */
export function calculateInvoice(input, { taxLabel = 'Standard Rate' } = {}) {
  const items = input.items.map((item) => {
    const gross = round2(item.quantity * item.rate);
    const discountAmount = round2((gross * (item.discountPercent ?? 0)) / 100);
    const amount = round2(gross - discountAmount);
    const taxAmount = round2((amount * (item.taxRate ?? 0)) / 100);
    return { ...item, amount, discountAmount, taxAmount };
  });

  const subTotal = round2(items.reduce((sum, i) => sum + round2(i.quantity * i.rate), 0));
  const discountTotal = round2(items.reduce((sum, i) => sum + i.discountAmount, 0));
  const taxableAmount = round2(items.reduce((sum, i) => sum + i.amount, 0));
  const taxTotal = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
  const total = round2(taxableAmount + taxTotal);
  const amountPaid = round2(Math.min(input.amountPaid ?? 0, total));
  const balanceDue = round2(total - amountPaid);

  // One summary row per distinct tax rate, as in the template's TAX SUMMARY box.
  const byRate = new Map();
  for (const item of items) {
    if (!item.taxRate) continue;
    const row = byRate.get(item.taxRate) ?? { label: `${taxLabel} (${item.taxRate}%)`, rate: item.taxRate, taxable: 0, tax: 0 };
    row.taxable = round2(row.taxable + item.amount);
    row.tax = round2(row.tax + item.taxAmount);
    byRate.set(item.taxRate, row);
  }

  return {
    items,
    subTotal,
    discountTotal,
    taxableAmount,
    taxTotal,
    total,
    amountPaid,
    balanceDue,
    taxSummary: [...byRate.values()].sort((a, b) => a.rate - b.rate),
  };
}

async function loadCompany(companyId) {
  const company = await Company.findById(companyId);
  if (!company) {
    throw ApiError.badRequest('Select a valid company', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'company', message: 'Company not found' }],
    });
  }
  return company;
}

async function assertCustomerExists(customerId) {
  if (customerId && !(await Customer.exists({ _id: customerId }))) {
    throw ApiError.badRequest('Select a valid customer', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'customer', message: 'Customer not found' }],
    });
  }
}

/** Ship To falls back to Bill To field by field, so blanks inherit rather than erase. */
function resolveShipTo({ billTo, shipTo, shipToSameAsBillTo }) {
  if (shipToSameAsBillTo) return { ...billTo };
  const filled = Object.fromEntries(Object.entries(shipTo ?? {}).filter(([, v]) => v !== '' && v != null));
  return { ...billTo, ...filled };
}

function buildPayload(input, company) {
  const totals = calculateInvoice(input, { taxLabel: company.invoice?.taxLabel });
  const shipTo = resolveShipTo(input);
  return {
    ...input,
    ...totals,
    shipTo,
    currency: company.currency,
    seller: companySnapshot(company),
  };
}

export async function listInvoices(query) {
  const { search, company, customer, status, from, to, sortBy, sortOrder } = query;
  const filter = {};
  if (company) filter.company = company;
  if (customer) filter.customer = customer;
  if (status) filter.status = status;
  if (from || to) filter.invoiceDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ invoiceNumber: rx }, { 'billTo.name': rx }, { poNumber: rx }];
  }

  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Invoice.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}

export async function getInvoice(id) {
  const invoice = await Invoice.findById(id).populate(POPULATE);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return invoice;
}

export async function createInvoice(input, actor) {
  const company = await loadCompany(input.company);
  await assertCustomerExists(input.customer);

  if (input.invoiceNumber && (await Invoice.exists({ invoiceNumber: input.invoiceNumber }))) {
    throw ApiError.conflict('An invoice with this number already exists', {
      details: [{ path: 'invoiceNumber', message: 'This invoice number is already in use' }],
    });
  }

  const invoice = await Invoice.create({
    ...buildPayload(input, company),
    invoiceNumber: input.invoiceNumber || (await nextInvoiceNumber(company._id, new Date(input.invoiceDate))),
    createdBy: actor._id,
  });

  await audit(actor, 'invoice.created', 'invoice', invoice._id, `Created invoice ${invoice.invoiceNumber} for ${invoice.billTo?.name ?? 'customer'}`);
  return invoice.populate(POPULATE);
}

export async function updateInvoice(id, input, actor) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const company = await loadCompany(input.company);
  await assertCustomerExists(input.customer);

  if (input.invoiceNumber && input.invoiceNumber !== invoice.invoiceNumber) {
    if (await Invoice.exists({ _id: { $ne: invoice._id }, invoiceNumber: input.invoiceNumber })) {
      throw ApiError.conflict('An invoice with this number already exists', {
        details: [{ path: 'invoiceNumber', message: 'This invoice number is already in use' }],
      });
    }
  }

  Object.assign(invoice, buildPayload(input, company), {
    invoiceNumber: input.invoiceNumber || invoice.invoiceNumber,
    updatedBy: actor._id,
  });
  await invoice.save();

  await audit(actor, 'invoice.updated', 'invoice', invoice._id, `Updated invoice ${invoice.invoiceNumber}`);
  return invoice.populate(POPULATE);
}

export async function updateInvoiceStatus(id, { status, amountPaid }, actor) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  invoice.status = status;
  if (amountPaid !== undefined) invoice.amountPaid = round2(Math.min(amountPaid, invoice.total));
  if (status === 'paid') invoice.amountPaid = invoice.total;
  invoice.balanceDue = round2(invoice.total - invoice.amountPaid);
  invoice.updatedBy = actor._id;
  await invoice.save();

  await audit(actor, 'invoice.statusChanged', 'invoice', invoice._id, `Marked invoice ${invoice.invoiceNumber} as ${status}`);
  return invoice.populate(POPULATE);
}

export async function deleteInvoice(id, actor) {
  const invoice = await Invoice.findByIdAndDelete(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  await audit(actor, 'invoice.deleted', 'invoice', invoice._id, `Deleted invoice ${invoice.invoiceNumber}`);
}

/** Values used to pre-fill a new invoice for the chosen company. */
export async function getInvoiceDefaults(companyId) {
  const company = companyId ? await loadCompany(companyId) : null;
  if (!company) throw ApiError.conflict('Add a company in Settings before creating invoices', { code: 'NO_COMPANY' });

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (company.invoice?.paymentTermsDays ?? 30));

  return {
    company: company.id,
    currency: company.currency,
    invoiceDate: invoiceDate.toISOString().slice(0, 10),
    dueDate: dueDate.toISOString().slice(0, 10),
    paymentTerms: company.invoice?.paymentTerms ?? '',
    notes: company.invoice?.notes ?? '',
    terms: company.invoice?.terms ?? '',
    defaultTaxRate: company.invoice?.defaultTaxRate ?? 0,
    quantityLabel: company.invoice?.quantityLabel ?? 'Qty',
    nextNumberPreview: `${company.invoice?.prefix ?? 'INV-'}${
      company.invoice?.includeYearMonth
        ? `${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`
        : ''
    }${String(company.invoice?.nextNumber ?? 1).padStart(company.invoice?.sequencePadding ?? 6, '0')}`,
  };
}

/** Totals for the Finance dashboard card. */
export async function getInvoiceSummary() {
  const [rows] = await Invoice.aggregate([
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: '$total' },
        outstanding: { $sum: { $cond: [{ $in: ['$status', ['sent']] }, '$balanceDue', 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] } },
      },
    },
  ]);
  return { count: rows?.count ?? 0, total: round2(rows?.total ?? 0), outstanding: round2(rows?.outstanding ?? 0), paid: round2(rows?.paid ?? 0) };
}
