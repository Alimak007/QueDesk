import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from '../modules/auth/auth.routes.js';
import dailyStatusRoutes from '../modules/daily-status/dailyStatus.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import eventRoutes from '../modules/events/event.routes.js';
import leaveRoutes from '../modules/leaves/leave.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
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

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/employees', userRoutes);
router.use('/leaves', leaveRoutes);
router.use('/daily-status', dailyStatusRoutes);
router.use('/events', eventRoutes);
router.use('/sales', salesRoutes);
router.use('/notifications', notificationRoutes);

export default router;
