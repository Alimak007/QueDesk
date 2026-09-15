import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ok } from '../../utils/response.js';
import { booleanQuery, idParams } from '../../utils/validators.js';
import * as notificationService from './notification.service.js';

const router = Router();

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: booleanQuery,
});

router.use(authenticate);

// Every query is scoped to `req.user`, so users only ever see their own notifications.
router.get('/', validate({ query: listQuery }), async (req, res) =>
  ok(res, await notificationService.listNotifications(req.user._id, req.valid.query)),
);

router.patch('/read-all', async (req, res) => ok(res, await notificationService.markAllRead(req.user._id)));

router.patch('/:id/read', validate({ params: idParams }), async (req, res) =>
  ok(res, { notification: await notificationService.markRead(req.user._id, req.valid.params.id) }),
);

export default router;
