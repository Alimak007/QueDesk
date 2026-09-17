import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

export const INVOICE_STATUSES = Object.freeze(['draft', 'sent', 'paid', 'cancelled']);

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    /** Derived on the server: quantity × rate, less discount (tax excluded). */
    amount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const partySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '', maxlength: 150 },
    address: { type: String, trim: true, default: '', maxlength: 500 },
    taxNumber: { type: String, trim: true, default: '', maxlength: 60 },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    status: { type: String, enum: INVOICE_STATUSES, default: 'draft', index: true },
    invoiceDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    paymentTerms: { type: String, trim: true, default: '', maxlength: 120 },
    poNumber: { type: String, trim: true, default: '', maxlength: 60 },
    poDate: { type: String, default: null },
    currency: { type: String, uppercase: true, trim: true, default: 'AED', maxlength: 3 },
    billTo: { type: partySchema, default: () => ({}) },
    shipTo: { type: partySchema, default: () => ({}) },
    shipToSameAsBillTo: { type: Boolean, default: true },
    items: { type: [itemSchema], default: [] },
    /** All totals are recalculated on the server before saving. */
    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0 },
    taxSummary: {
      type: [new mongoose.Schema({ label: String, rate: Number, taxable: Number, tax: Number }, { _id: false })],
      default: [],
    },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    terms: { type: String, trim: true, default: '', maxlength: 2000 },
    /** Seller details frozen onto the invoice so it stays a faithful record. */
    seller: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ company: 1, invoiceDate: -1 });
invoiceSchema.index({ customer: 1, invoiceDate: -1 });

/** Unpaid and past its due date. */
invoiceSchema.virtual('isOverdue').get(function isOverdue() {
  if (this.status !== 'sent' || this.balanceDue <= 0) return false;
  return this.dueDate < new Date().toISOString().slice(0, 10);
});

toJSONPlugin(invoiceSchema);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
