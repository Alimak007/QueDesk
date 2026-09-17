import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

const bankSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    iban: { type: String, trim: true, default: '' },
    swift: { type: String, trim: true, default: '' },
    branchAddress: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

/** Everything the invoice template needs that is not part of the invoice itself. */
const invoiceSettingsSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: 'TAX INVOICE' },
    prefix: { type: String, trim: true, default: 'INV-', maxlength: 12 },
    /** Adds YYYYMM between the prefix and the sequence, e.g. INV-202605000016. */
    includeYearMonth: { type: Boolean, default: true },
    sequencePadding: { type: Number, default: 6, min: 1, max: 10 },
    nextNumber: { type: Number, default: 1, min: 1 },
    quantityLabel: { type: String, trim: true, default: 'Hours', maxlength: 20 },
    taxLabel: { type: String, trim: true, default: 'Standard Rate', maxlength: 40 },
    defaultTaxRate: { type: Number, default: 5, min: 0, max: 100 },
    paymentTermsDays: { type: Number, default: 30, min: 0, max: 365 },
    paymentTerms: { type: String, trim: true, default: '30 days from invoice date', maxlength: 120 },
    notes: { type: String, trim: true, default: 'Thank you for your business', maxlength: 1000 },
    terms: { type: String, trim: true, default: '', maxlength: 2000 },
    showShipTo: { type: Boolean, default: true },
    signatureLabel: { type: String, trim: true, default: 'Authorized Signature', maxlength: 60 },
  },
  { _id: false },
);

/** Everything the payslip template needs. */
const payslipSettingsSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: 'Payslip' },
    prefix: { type: String, trim: true, default: 'PS-', maxlength: 12 },
    confidentialityNote: { type: String, trim: true, default: 'Private & Confidential', maxlength: 120 },
    /** Shown in the payslip amount columns. Empty falls back to the company currency code. */
    currencyLabel: { type: String, trim: true, default: '', maxlength: 10 },
    footerNote: {
      type: String,
      trim: true,
      default: 'This is a system generated statement and does not require any signature or stamp',
      maxlength: 300,
    },
    defaultEarnings: { type: [String], default: ['Basic Pay', 'House Rent Allowance (HRA)', 'Transportation Allowance', 'Food Allowance'] },
    defaultDeductions: { type: [String], default: [] },
  },
  { _id: false },
);

/**
 * Where a logo or signature lives. `cloudinary` images are referenced by their
 * public id; `database` images are rows in the Asset collection (the fallback
 * used when Cloudinary is not configured).
 */
const companyImageSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['cloudinary', 'database'], required: true },
    publicId: { type: String, default: '' },
    version: { type: String, default: '' },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    format: { type: String, default: 'png' },
    mimeType: { type: String, default: 'image/png' },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    /** Short name used in the payslip header, e.g. "Que". */
    shortName: { type: String, trim: true, default: '', maxlength: 40 },
    address: { type: String, trim: true, default: '', maxlength: 500 },
    phone: { type: String, trim: true, default: '', maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, default: '', maxlength: 120 },
    website: { type: String, trim: true, default: '', maxlength: 120 },
    /** What the tax number is called locally: TRN, VAT, GSTIN… */
    taxLabel: { type: String, trim: true, default: 'TRN', maxlength: 20 },
    taxNumber: { type: String, trim: true, default: '', maxlength: 60 },
    registrationNumber: { type: String, trim: true, default: '', maxlength: 60 },
    currency: { type: String, uppercase: true, trim: true, default: 'AED', maxlength: 3 },
    logo: { type: companyImageSchema, default: null },
    signature: { type: companyImageSchema, default: null },
    bank: { type: bankSchema, default: () => ({}) },
    invoice: { type: invoiceSettingsSchema, default: () => ({}) },
    payslip: { type: payslipSettingsSchema, default: () => ({}) },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

companySchema.index({ name: 1 });

toJSONPlugin(companySchema);

export const Company = mongoose.model('Company', companySchema);
