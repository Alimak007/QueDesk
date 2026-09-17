import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/index.js';
import { DEFAULT_EMPLOYEE_PERMISSIONS, MODULE_KEYS, PERMISSION_MODULES } from '../../constants/permissions.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { effectivePermissions, normalizePermissions } from '../../utils/permissions.js';
import { ok } from '../../utils/response.js';
import { idParams } from '../../utils/validators.js';
import { audit } from '../audit/audit.service.js';
import { User } from '../users/user.model.js';

const router = Router();

const permissionsBody = z.object({
  permissions: z.object(
    Object.fromEntries(
      MODULE_KEYS.map((module) => [
        module,
        z.array(z.enum(Object.keys(PERMISSION_MODULES[module].actions))).max(10).optional(),
      ]),
    ),
  ),
});

router.use(authenticate, authorize(ROLES.ADMIN));

/** The catalogue the Permissions screen renders from. */
router.get('/catalog', (_req, res) =>
  ok(res, {
    modules: MODULE_KEYS.map((key) => ({
      key,
      label: PERMISSION_MODULES[key].label,
      group: PERMISSION_MODULES[key].group,
      actions: Object.entries(PERMISSION_MODULES[key].actions).map(([action, description]) => ({ action, description })),
    })),
    defaults: DEFAULT_EMPLOYEE_PERMISSIONS,
  }),
);

router.get('/users/:id', validate({ params: idParams }), async (req, res) => {
  const user = await User.findById(req.valid.params.id);
  if (!user) throw ApiError.notFound('Employee not found');
  return ok(res, {
    user,
    permissions: effectivePermissions(user),
    isCustomised: Boolean(user.permissions),
  });
});

router.put('/users/:id', validate({ params: idParams, body: permissionsBody }), async (req, res) => {
  const user = await User.findById(req.valid.params.id);
  if (!user) throw ApiError.notFound('Employee not found');
  if (user.role === ROLES.ADMIN) {
    throw ApiError.conflict('Administrators always have full access. Change the role first to limit permissions.');
  }

  const before = effectivePermissions(user);
  const next = normalizePermissions(req.valid.body.permissions);
  user.permissions = next;
  await user.save();

  const changes = MODULE_KEYS.flatMap((module) => {
    const added = next[module].filter((a) => !before[module].includes(a)).map((a) => `+${module}.${a}`);
    const removed = before[module].filter((a) => !next[module].includes(a)).map((a) => `-${module}.${a}`);
    return [...added, ...removed];
  });

  if (changes.length) {
    await audit(req.user, 'permission.updated', 'permission', user._id, `Updated permissions for ${user.fullName}`, { changes });
  }
  return ok(res, { user, permissions: next });
});

/** Puts an employee back on the standard defaults. */
router.post('/users/:id/reset', validate({ params: idParams }), async (req, res) => {
  const user = await User.findById(req.valid.params.id);
  if (!user) throw ApiError.notFound('Employee not found');

  // Removing the field (rather than emptying it) restores the employee defaults.
  await User.updateOne({ _id: user._id }, { $unset: { permissions: 1 } });
  const refreshed = await User.findById(user._id);

  await audit(req.user, 'permission.reset', 'permission', user._id, `Reset permissions for ${user.fullName} to defaults`);
  return ok(res, { user: refreshed, permissions: effectivePermissions(refreshed) });
});

export default router;
