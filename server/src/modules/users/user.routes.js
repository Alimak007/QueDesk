import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './user.controller.js';
import {
  createUserSchema,
  listUsersQuery,
  resetPasswordSchema,
  updateStatusSchema,
  updateUserSchema,
} from './user.validation.js';

const router = Router();

router.use(authenticate);

// Available to every signed-in user (non-sensitive fields only).
router.get('/directory', controller.directory);

router.get('/', requirePermission('employees', 'view'), validate({ query: listUsersQuery }), controller.list);
router.get('/departments', requirePermission('employees', 'view', 'create', 'edit'), controller.departments);
router.post('/', requirePermission('employees', 'create'), validate({ body: createUserSchema }), controller.create);
router.get('/:id', requirePermission('employees', 'view'), validate({ params: idParams }), controller.getOne);
router.patch(
  '/:id',
  requirePermission('employees', 'edit'),
  validate({ params: idParams, body: updateUserSchema }),
  controller.update,
);
router.patch(
  '/:id/status',
  requirePermission('employees', 'edit'),
  validate({ params: idParams, body: updateStatusSchema }),
  controller.updateStatus,
);
router.post(
  '/:id/reset-password',
  requirePermission('employees', 'edit'),
  validate({ params: idParams, body: resetPasswordSchema }),
  controller.resetPassword,
);
router.delete('/:id', requirePermission('employees', 'delete'), validate({ params: idParams }), controller.remove);

export default router;
