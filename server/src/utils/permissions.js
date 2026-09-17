import { ROLES } from '../constants/index.js';
import { DEFAULT_EMPLOYEE_PERMISSIONS, MODULE_KEYS, PERMISSION_MODULES } from '../constants/permissions.js';

const ALL_PERMISSIONS = Object.freeze(
  Object.fromEntries(MODULE_KEYS.map((m) => [m, Object.keys(PERMISSION_MODULES[m].actions)])),
);

/** Keeps only known modules/actions, in catalogue order. */
export function normalizePermissions(input = {}) {
  return Object.fromEntries(
    MODULE_KEYS.map((module) => {
      const allowed = Object.keys(PERMISSION_MODULES[module].actions);
      const granted = new Set(Array.isArray(input?.[module]) ? input[module] : []);
      return [module, allowed.filter((a) => granted.has(a))];
    }),
  );
}

/** The permissions that actually apply to a user. Admins always have everything. */
export function effectivePermissions(user) {
  if (!user) return normalizePermissions({});
  if (user.role === ROLES.ADMIN) return ALL_PERMISSIONS;
  const stored = user.permissions && typeof user.permissions.toObject === 'function' ? user.permissions.toObject() : user.permissions;
  const hasStored = stored && MODULE_KEYS.some((m) => Array.isArray(stored[m]));
  return normalizePermissions(hasStored ? stored : DEFAULT_EMPLOYEE_PERMISSIONS);
}

/** True when the user holds at least one of the given actions on the module. */
export function can(user, module, ...actions) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  const granted = effectivePermissions(user)[module] ?? [];
  return actions.some((a) => granted.includes(a));
}

/** Public shape of a user including their effective permissions. */
export function serializeUser(user) {
  if (!user) return null;
  const json = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  return { ...json, permissions: effectivePermissions(user) };
}
