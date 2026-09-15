import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { ok } from '../../utils/response.js';
import { isAdmin } from '../../utils/scope.js';
import { getAdminDashboard, getEmployeeDashboard } from './dashboard.service.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const data = isAdmin(req.user) ? await getAdminDashboard() : await getEmployeeDashboard(req.user);
  return ok(res, { role: req.user.role, ...data });
});

export default router;
