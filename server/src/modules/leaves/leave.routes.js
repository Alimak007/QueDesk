import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './leave.controller.js';
import { leaveSchema, listLeavesQuery, reviewLeaveSchema, summaryQuery } from './leave.validation.js';

const router = Router();

router.use(authenticate);

// Reads are role-scoped inside the service: employees see only their own leaves.
router.get('/', validate({ query: listLeavesQuery }), controller.list);
router.get('/summary', validate({ query: summaryQuery }), controller.summary);
router.post('/preview', validate({ body: leaveSchema }), controller.preview);
router.get('/:id', validate({ params: idParams }), controller.getOne);

router.post('/', authorize(ROLES.EMPLOYEE), validate({ body: leaveSchema }), controller.apply);
router.put('/:id', validate({ params: idParams, body: leaveSchema }), controller.update);
router.patch('/:id/cancel', authorize(ROLES.EMPLOYEE), validate({ params: idParams }), controller.cancel);
router.patch(
  '/:id/review',
  authorize(ROLES.ADMIN),
  validate({ params: idParams, body: reviewLeaveSchema }),
  controller.review,
);

export default router;
