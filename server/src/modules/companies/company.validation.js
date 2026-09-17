import { z } from 'zod';
import { optionalTrimmed, trimmed } from '../../utils/validators.js';

const bankSchema = z
  .object({
    bankName: optionalTrimmed('Bank name', 120),
    accountName: optionalTrimmed('Account name', 150),
    accountNumber: optionalTrimmed('Account number', 60),
    iban: optionalTrimmed('IBAN', 60),
    swift: optionalTrimmed('SWIFT', 30),
    branchAddress: optionalTrimmed('Branch address', 200),
  })
  .optional();

const invoiceSettingsSchema = z
  .object({
    title: optionalTrimmed('Invoice title', 60),
    prefix: optionalTrimmed('Invoice prefix', 12),
    includeYearMonth: z.boolean().optional(),
    sequencePadding: z.coerce.number().int().min(1).max(10).optional(),
    nextNumber: z.coerce.number().int().min(1).max(9_999_999).optional(),
    quantityLabel: optionalTrimmed('Quantity label', 20),
    taxLabel: optionalTrimmed('Tax label', 40),
    defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
    paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
    paymentTerms: optionalTrimmed('Payment terms', 120),
    notes: optionalTrimmed('Notes', 1000),
    terms: optionalTrimmed('Terms', 2000),
    showShipTo: z.boolean().optional(),
    signatureLabel: optionalTrimmed('Signature label', 60),
  })
  .optional();

const payslipSettingsSchema = z
  .object({
    title: optionalTrimmed('Payslip title', 60),
    prefix: optionalTrimmed('Payslip prefix', 12),
    confidentialityNote: optionalTrimmed('Confidentiality note', 120),
    currencyLabel: optionalTrimmed('Currency label', 10),
    footerNote: optionalTrimmed('Footer note', 300),
    defaultEarnings: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    defaultDeductions: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  })
  .optional();

const companyFields = {
  name: trimmed('Company name', { max: 150 }),
  shortName: optionalTrimmed('Short name', 40),
  address: optionalTrimmed('Address', 500),
  phone: optionalTrimmed('Phone', 40),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'))]).optional(),
  website: optionalTrimmed('Website', 120),
  taxLabel: optionalTrimmed('Tax label', 20),
  taxNumber: optionalTrimmed('Tax number', 60),
  registrationNumber: optionalTrimmed('Registration number', 60),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
    .transform((s) => s.toUpperCase())
    .optional(),
  bank: bankSchema,
  invoice: invoiceSettingsSchema,
  payslip: payslipSettingsSchema,
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

export const createCompanySchema = z.object(companyFields);
export const updateCompanySchema = z.object({ ...companyFields, name: companyFields.name.optional() });

export const listCompaniesQuery = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const assetKindParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
  kind: z.enum(['logo', 'signature']),
});
