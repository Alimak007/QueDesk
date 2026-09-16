import { ROLES } from '../constants/index.js';
import { can } from './permissions.js';

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

/**
 * Returns the base filter that restricts private, per-employee collections
 * (leaves, daily status) to what the actor is allowed to see. This is the
 * single enforcement point for the "employees only see their own data" rule;
 * every read and write query on those collections must start from it.
 */
export function ownershipScope(actor, { module, manageAction, field = 'employee' } = {}) {
  const orgWide = isAdmin(actor) || (module && manageAction && can(actor, module, manageAction));
  return orgWide ? {} : { [field]: actor._id };
}

/** Whether the actor may see and act on everyone's records in a private module. */
export function canManage(actor, module, manageAction) {
  return isAdmin(actor) || can(actor, module, manageAction);
}
