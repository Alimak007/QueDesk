/**
 * Module-level permission catalogue.
 *
 * Admins implicitly hold every permission. Employees hold only what is stored
 * on their account (or DEFAULT_EMPLOYEE_PERMISSIONS when nothing is stored).
 *
 * For Leave and Daily Status the basic actions apply to the employee's OWN
 * records; `approve` / `review` unlock the organisation-wide views, so the
 * privacy rule "employees only see their own leave and reports" still holds by
 * default.
 */
export const PERMISSION_MODULES = Object.freeze({
  leads: {
    label: 'Leads',
    group: 'CRM',
    actions: { view: 'View leads', create: 'Add leads', edit: 'Edit & move leads', delete: 'Delete leads' },
  },
  customers: {
    label: 'Customers',
    group: 'CRM',
    actions: { view: 'View customers', create: 'Add customers & convert leads', edit: 'Edit customers', delete: 'Delete customers' },
  },
  employees: {
    label: 'Employees',
    group: 'HR',
    actions: { view: 'View employee records', create: 'Add employees', edit: 'Edit, (de)activate & reset passwords', delete: 'Delete employees' },
  },
  leave: {
    label: 'Leave',
    group: 'HR',
    actions: {
      view: 'View own leave',
      create: 'Apply for leave',
      edit: 'Edit own pending leave',
      delete: 'Cancel own leave',
      approve: 'View all requests & approve / reject',
    },
  },
  dailyStatus: {
    label: 'Daily Status',
    group: 'HR',
    actions: {
      view: 'View own reports',
      create: 'Submit reports',
      edit: 'Edit own reports',
      review: "View & edit everyone's reports",
    },
  },
  payslips: {
    label: 'Payslips',
    group: 'HR',
    actions: { view: 'View payslips', create: 'Generate payslips', edit: 'Edit payslips', delete: 'Delete payslips', download: 'Download PDF' },
  },
  invoices: {
    label: 'Invoices',
    group: 'Finance',
    actions: { view: 'View invoices', create: 'Create invoices', edit: 'Edit invoices', delete: 'Delete invoices', download: 'Download PDF' },
  },
  calendar: {
    label: 'Calendar',
    group: 'General',
    actions: { view: 'View calendar', create: 'Add events', edit: 'Edit events', delete: 'Delete events' },
  },
});

export const MODULE_KEYS = Object.freeze(Object.keys(PERMISSION_MODULES));

/** What a newly created employee can do — mirrors the original portal behaviour. */
export const DEFAULT_EMPLOYEE_PERMISSIONS = Object.freeze({
  leads: ['view', 'create', 'edit'],
  customers: [],
  employees: [],
  leave: ['view', 'create', 'edit', 'delete'],
  dailyStatus: ['view', 'create', 'edit'],
  payslips: [],
  invoices: [],
  calendar: ['view'],
});
