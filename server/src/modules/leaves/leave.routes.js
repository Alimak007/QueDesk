import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { uploadSpreadsheet } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './leave.controller.js';
import {
  balancesQuery,
  importLeaveBody,
  leaveSchema,
  listLeavesQuery,
  recordLeaveSchema,
  reviewLeaveSchema,
  summaryQuery,
} from './leave.validation.js';

const router = Router();
const canRead = requirePermission('leave', 'view', 'approve');

router.use(authenticate);

// Reads are scoped inside the service: only approvers see other employees' leave.
router.get('/', canRead, validate({ query: listLeavesQuery }), controller.list);
router.get('/summary', canRead, validate({ query: summaryQuery }), controller.summary);
router.get('/balances', canRead, validate({ query: balancesQuery }), controller.balances);
router.post(
  '/preview',
  requirePermission('leave', 'create', 'edit', 'approve'),
  validate({ body: leaveSchema }),
  controller.preview,
);
// Recording already-approved leave (one at a time or from a register) is for approvers.
const canRecord = requirePermission('leave', 'approve');
router.get('/import/template', canRecord, controller.importTemplate);
router.post('/import', canRecord, uploadSpreadsheet, validate({ body: importLeaveBody }), controller.importRecords);
router.post('/records', canRecord, validate({ body: recordLeaveSchema }), controller.record);

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
