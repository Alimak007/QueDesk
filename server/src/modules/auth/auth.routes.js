import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.js';
import { loginLimiter } from '../../middlewares/rateLimiter.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './auth.controller.js';
import { changePasswordSchema, loginSchema, updateProfileSchema } from './auth.validation.js';

const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
router.post('/logout', controller.logout);
// Session probe for app start-up: 200 with `user: null` when signed out.
router.get('/session', optionalAuthenticate, controller.me);
router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), controller.updateProfile);
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);

export default router;
