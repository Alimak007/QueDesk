import { Router } from 'express';
import mongoose from 'mongoose';
import { isDatabaseReady } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import companyRoutes from '../modules/companies/company.routes.js';
import customerRoutes from '../modules/customers/customer.routes.js';
import dailyStatusRoutes from '../modules/daily-status/dailyStatus.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import eventRoutes from '../modules/events/event.routes.js';
import invoiceRoutes from '../modules/invoices/invoice.routes.js';
import leaveRoutes from '../modules/leaves/leave.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import payslipRoutes from '../modules/payslips/payslip.routes.js';
import permissionRoutes from '../modules/permissions/permission.routes.js';
import salesRoutes from '../modules/sales/sales.routes.js';
import userRoutes from '../modules/users/user.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    data: { status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'connected' : 'disconnected', uptime: process.uptime() },
  });
});

/**
 * Everything below needs data. Answering straight away beats letting each
 * query wait out the server-selection timeout and fail with a driver error.
 */
router.use((_req, _res, next) =>
  isDatabaseReady()
    ? next()
    : next(
        new ApiError(503, 'The server cannot reach its database right now. Please try again in a moment.', {
          code: 'DATABASE_UNAVAILABLE',
        }),
      ),
);

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/employees', userRoutes);
router.use('/leaves', leaveRoutes);
router.use('/daily-status', dailyStatusRoutes);
router.use('/events', eventRoutes);
router.use('/sales', salesRoutes);
router.use('/customers', customerRoutes);
router.use('/companies', companyRoutes);
router.use('/payslips', payslipRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/permissions', permissionRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/notifications', notificationRoutes);

export default router;
