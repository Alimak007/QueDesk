import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
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

// Everything below is admin-only.
router.use(authorize(ROLES.ADMIN));

router.get('/', validate({ query: listUsersQuery }), controller.list);
router.get('/departments', controller.departments);
router.post('/', validate({ body: createUserSchema }), controller.create);
router.get('/:id', validate({ params: idParams }), controller.getOne);
router.patch('/:id', validate({ params: idParams, body: updateUserSchema }), controller.update);
router.patch('/:id/status', validate({ params: idParams, body: updateStatusSchema }), controller.updateStatus);
router.post(
  '/:id/reset-password',
  validate({ params: idParams, body: resetPasswordSchema }),
  controller.resetPassword,
);
router.delete('/:id', validate({ params: idParams }), controller.remove);

export default router;
