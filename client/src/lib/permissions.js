import { ROLES } from './constants';

/**
 * Mirrors the server's permission catalogue. The API is the source of truth:
 * these helpers only decide what to show, never what is allowed.
 */
export const PERMISSION_MODULES = {
  leads: 'Leads',
  customers: 'Customers',
  employees: 'Employees',
  leave: 'Leave',
  dailyStatus: 'Daily Status',
  payslips: 'Payslips',
  invoices: 'Invoices',
  calendar: 'Calendar',
};

/** True when the user holds at least one of the given actions on the module. */
export function can(user, module, ...actions) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  const granted = user.permissions?.[module] ?? [];
  return actions.some((action) => granted.includes(action));
}

/** True when the user can see anything at all in the module. */
export const canAccessModule = (user, module) =>
  can(user, module, 'view', 'create', 'edit', 'delete', 'download', 'approve', 'review');
