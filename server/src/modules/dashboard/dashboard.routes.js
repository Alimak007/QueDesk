import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { can } from '../../utils/permissions.js';
import { ok } from '../../utils/response.js';
import { isAdmin } from '../../utils/scope.js';
import { getAdminDashboard, getEmployeeDashboard } from './dashboard.service.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  // Admins, and employees with organisation-wide permissions, get the overview dashboard.
  const manages =
    isAdmin(req.user) ||
    can(req.user, 'leave', 'approve') ||
    can(req.user, 'dailyStatus', 'review') ||
    can(req.user, 'invoices', 'view') ||
    can(req.user, 'employees', 'view');

  const data = manages ? await getAdminDashboard(req.user) : await getEmployeeDashboard(req.user);
  return ok(res, { role: req.user.role, view: manages ? 'manager' : 'employee', ...data });
});

export default router;
