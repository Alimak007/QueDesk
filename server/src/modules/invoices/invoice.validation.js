import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';
import { dateOnly, objectId, optionalTrimmed, trimmed } from '../../utils/validators.js';
import { INVOICE_STATUSES } from './invoice.model.js';

const itemSchema = z.object({
  description: trimmed('Description', { max: 500 }),
  quantity: z.coerce.number({ error: 'Enter a quantity' }).min(0, 'Quantity cannot be negative').max(1_000_000),
  rate: z.coerce.number({ error: 'Enter a rate' }).min(0, 'Rate cannot be negative').max(1_000_000_000),
  discountPercent: z.coerce.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%').default(0),
  taxRate: z.coerce.number().min(0, 'Tax cannot be negative').max(100, 'Tax cannot exceed 100%').default(0),
});

const partySchema = z.object({
  name: trimmed('Name', { max: 150 }),
  address: optionalTrimmed('Address', 500),
  taxNumber: optionalTrimmed('Tax number', 60),
});

/**
 * Ship To may arrive completely blank: the form still submits the fields while
 * "Ship to the same address" is ticked, and in that case Bill To is copied over
 * it anyway. The name is only required once the two addresses differ.
 */
const shipToSchema = z.object({
  name: optionalTrimmed('Name', 150),
  address: optionalTrimmed('Address', 500),
  taxNumber: optionalTrimmed('Tax number', 60),
});

const invoiceFields = {
  company: objectId('company'),
  customer: objectId('customer').nullable().optional(),
  status: z.enum(INVOICE_STATUSES).default('draft'),
  invoiceNumber: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9/_-]+$/, 'Invoice number can contain letters, numbers, - / and _')
    .optional(),
  invoiceDate: dateOnly('Invoice date'),
  dueDate: dateOnly('Due date'),
  paymentTerms: optionalTrimmed('Payment terms', 120),
  poNumber: optionalTrimmed('P.O. number', 60),
  poDate: dateOnly('P.O. date').nullable().optional(),
  billTo: partySchema,
  shipTo: shipToSchema.optional(),
  shipToSameAsBillTo: z.boolean().default(true),
  items: z.array(itemSchema).min(1, 'Add at least one line item').max(100, 'At most 100 line items'),
  amountPaid: z.coerce.number().min(0, 'Amount paid cannot be negative').default(0),
  notes: optionalTrimmed('Notes', 1000),
  terms: optionalTrimmed('Terms', 2000),
};

function refineInvoice(v, ctx) {
  if (v.dueDate < v.invoiceDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before the invoice date' });
  }
  if (!v.shipToSameAsBillTo && !v.shipTo?.name) {
    ctx.addIssue({
      code: 'custom',
      path: ['shipTo', 'name'],
      message: 'Enter who the goods ship to, or tick “Ship to the same address”',
    });
  }
}

export const createInvoiceSchema = z.object(invoiceFields).superRefine(refineInvoice);
export const updateInvoiceSchema = z.object(invoiceFields).superRefine(refineInvoice);

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
  amountPaid: z.coerce.number().min(0).optional(),
});

export const listInvoicesQuery = z
  .object({
    ...paginationQuery,
    search: z.string().trim().max(100).optional(),
    company: objectId('company').optional(),
    customer: objectId('customer').optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    from: dateOnly('From date').optional(),
    to: dateOnly('To date').optional(),
    sortBy: z.enum(['invoiceDate', 'dueDate', 'total', 'createdAt', 'invoiceNumber']).default('invoiceDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((v) => !v.from || !v.to || v.to >= v.from, { path: ['to'], message: '"to" must not be before "from"' });
