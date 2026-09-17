import { SYSTEM_CUSTOMER_FIELDS, SYSTEM_SALES_FIELDS } from '../../constants/index.js';

/** Initial Lead form (spec §11). Admins can relabel, reorder, extend or archive these. */
const LEAD_FIELDS = [
  {
    key: SYSTEM_SALES_FIELDS.TITLE,
    label: 'Lead Name',
    type: 'text',
    required: true,
    isSystem: true,
    placeholder: 'e.g. Website redesign for ABC Ltd',
  },
  { key: 'company', label: 'Company', type: 'text', placeholder: 'Company name' },
  { key: 'contactPerson', label: 'Contact Person', type: 'text', placeholder: 'Full name' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com' },
  { key: 'phone', label: 'Phone', type: 'phone', placeholder: '+971 50 123 4567', showInList: false },
  {
    key: SYSTEM_SALES_FIELDS.STATUS,
    label: 'Lead Status',
    type: 'dropdown',
    required: true,
    isSystem: true,
    defaultValue: 'new',
    options: [
      { value: 'new', label: 'New', color: 'blue' },
      { value: 'contacted', label: 'Contacted', color: 'cyan' },
      { value: 'follow_up', label: 'Follow-up', color: 'amber' },
      { value: 'negotiation', label: 'Negotiation', color: 'violet' },
      { value: 'won', label: 'Won', color: 'green' },
      { value: 'lost', label: 'Lost', color: 'red' },
    ],
  },
  { key: 'expectedValue', label: 'Expected Value', type: 'currency', placeholder: '0' },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Context, next steps…', showInList: false },
];

/**
 * Initial Customer form. It mirrors the Lead form so that converting a lead
 * carries the shared keys (company, contact, email, phone, notes) across.
 */
const CUSTOMER_FIELDS = [
  {
    key: SYSTEM_CUSTOMER_FIELDS.TITLE,
    label: 'Customer Name',
    type: 'text',
    required: true,
    isSystem: true,
    placeholder: 'e.g. ABC Ltd',
  },
  { key: 'company', label: 'Company', type: 'text', placeholder: 'Registered company name' },
  { key: 'contactPerson', label: 'Contact Person', type: 'text', placeholder: 'Full name' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com' },
  { key: 'phone', label: 'Phone', type: 'phone', placeholder: '+971 50 123 4567', showInList: false },
  {
    key: SYSTEM_CUSTOMER_FIELDS.STATUS,
    label: 'Customer Status',
    type: 'dropdown',
    required: true,
    isSystem: true,
    defaultValue: 'active',
    options: [
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'on_hold', label: 'On hold', color: 'amber' },
      { value: 'inactive', label: 'Inactive', color: 'slate' },
    ],
  },
  {
    key: 'billingAddress',
    label: 'Billing Address',
    type: 'textarea',
    placeholder: 'Street, area, city, country, P.O. Box',
    helpText: 'Used as “Bill To” on invoices.',
    showInList: false,
  },
  {
    key: 'taxNumber',
    label: 'TRN / Tax Number',
    type: 'text',
    placeholder: 'e.g. 100279169500003',
    helpText: 'Printed on tax invoices.',
    showInList: false,
  },
  { key: 'expectedValue', label: 'Contract Value', type: 'currency', placeholder: '0', showInList: false },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Anything the team should know', showInList: false },
];

export const DEFAULT_FIELDS = Object.freeze({ lead: LEAD_FIELDS, customer: CUSTOMER_FIELDS });

/** Kept for backwards compatibility with existing imports. */
export const DEFAULT_SALES_FIELDS = LEAD_FIELDS;
