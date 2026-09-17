import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './dailyStatus.controller.js';
import {
  createDailyStatusSchema,
  listDailyStatusQuery,
  teamBoardQuery,
  updateDailyStatusSchema,
} from './dailyStatus.validation.js';

const router = Router();
const canRead = requirePermission('dailyStatus', 'view', 'review');

router.use(authenticate);

// Reads and updates are scoped inside the service: only reviewers see other employees' reports.
router.get('/', canRead, validate({ query: listDailyStatusQuery }), controller.list);
router.get('/team', requirePermission('dailyStatus', 'review'), validate({ query: teamBoardQuery }), controller.teamBoard);
router.get('/:id', canRead, validate({ params: idParams }), controller.getOne);
router.post('/', requirePermission('dailyStatus', 'create'), validate({ body: createDailyStatusSchema }), controller.create);
router.put(
  '/:id',
  requirePermission('dailyStatus', 'edit', 'review'),
  validate({ params: idParams, body: updateDailyStatusSchema }),
  controller.update,
);

export default router;
