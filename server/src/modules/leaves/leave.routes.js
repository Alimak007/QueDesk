import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './leave.controller.js';
import { leaveSchema, listLeavesQuery, reviewLeaveSchema, summaryQuery } from './leave.validation.js';

const router = Router();
const canRead = requirePermission('leave', 'view', 'approve');

router.use(authenticate);

// Reads are scoped inside the service: only approvers see other employees' leave.
router.get('/', canRead, validate({ query: listLeavesQuery }), controller.list);
router.get('/summary', canRead, validate({ query: summaryQuery }), controller.summary);
router.post(
  '/preview',
  requirePermission('leave', 'create', 'edit', 'approve'),
  validate({ body: leaveSchema }),
  controller.preview,
);
router.get('/:id', canRead, validate({ params: idParams }), controller.getOne);

router.post('/', requirePermission('leave', 'create'), validate({ body: leaveSchema }), controller.apply);
// Own vs. other employees' leave is decided in the service (edit vs. approve).
router.put(
  '/:id',
  requirePermission('leave', 'edit', 'approve'),
  validate({ params: idParams, body: leaveSchema }),
  controller.update,
);
router.patch('/:id/cancel', requirePermission('leave', 'delete'), validate({ params: idParams }), controller.cancel);
router.patch(
  '/:id/review',
  requirePermission('leave', 'approve'),
  validate({ params: idParams, body: reviewLeaveSchema }),
  controller.review,
);

export default router;
