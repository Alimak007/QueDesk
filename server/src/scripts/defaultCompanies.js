/**
 * Company profiles taken from the supplied invoice and payslip templates.
 * Everything here is editable later in Administration → Settings → Companies;
 * the masked bank fields in the templates are intentionally left blank.
 */
export const DEFAULT_COMPANIES = [
  {
    name: 'QUE Info technologies CO. L.L.C S.O.C',
    shortName: 'Que',
    address: 'L13/01-A-19, Owned by BUR JUMAN CENTER (L.L.C),\nMankhool Dubai, United Arab Emirates',
    taxLabel: 'TRN',
    taxNumber: '105158954500003',
    currency: 'AED',
    isDefault: true,
    bank: {
      bankName: 'Mashreq NEO BIZ',
      accountName: 'QUE INFO TECHNOLOGIES CO LLC SOC',
      accountNumber: '',
      iban: '',
      swift: '',
      branchAddress: 'Dubai, UAE',
    },
    invoice: {
      title: 'TAX INVOICE',
      prefix: 'INV-',
      includeYearMonth: true,
      sequencePadding: 6,
      nextNumber: 17,
      quantityLabel: 'Hours',
      taxLabel: 'Standard Rate',
      defaultTaxRate: 5,
      paymentTermsDays: 30,
      paymentTerms: '30 days from invoice date',
      notes: 'Thank you for your business',
      showShipTo: true,
      signatureLabel: 'Authorized Signature',
    },
  },
  {
    name: 'Que Information Technology',
    shortName: 'Que',
    address:
      'C 1031, 10th Floor, Siddhi Vinayak Tower, TPS-84/B,\nOff. S G Highway, Makarba, Ahmedabad, Gujarat, India, 380051',
    website: 'Queinfotech.com',
    taxLabel: 'GSTIN',
    taxNumber: '',
    currency: 'INR',
    payslip: {
      title: 'Payslip',
      prefix: 'PS-',
      confidentialityNote: 'Private & Confidential',
      currencyLabel: 'Rs',
      footerNote: 'This is a system generated statement and does not require any signature or stamp',
      defaultEarnings: ['Basic Pay', 'House Rent Allowance (HRA)', 'Transportation Allowance', 'Food Allowance'],
      defaultDeductions: [],
    },
  },
];
