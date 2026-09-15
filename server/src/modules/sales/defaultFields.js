import { SYSTEM_SALES_FIELDS } from '../../constants/index.js';

/** Initial Sales form (spec §11). Admins can relabel, reorder, extend or archive these. */
export const DEFAULT_SALES_FIELDS = [
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
  { key: 'phone', label: 'Phone', type: 'phone', placeholder: '+91 98765 43210', showInList: false },
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
