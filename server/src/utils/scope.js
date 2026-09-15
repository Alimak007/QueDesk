import { ROLES } from '../constants/index.js';

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

/**
 * Returns the base filter that restricts private, per-employee collections
 * (leaves, daily status) to what the actor is allowed to see. This is the
 * single enforcement point for the "employees only see their own data" rule;
 * every read and write query on those collections must start from it.
 */
export function ownershipScope(actor, field = 'employee') {
  return isAdmin(actor) ? {} : { [field]: actor._id };
}
