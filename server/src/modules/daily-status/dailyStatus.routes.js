import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
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

router.use(authenticate);

// Reads and updates are role-scoped inside the service.
router.get('/', validate({ query: listDailyStatusQuery }), controller.list);
router.get('/team', authorize(ROLES.ADMIN), validate({ query: teamBoardQuery }), controller.teamBoard);
router.get('/:id', validate({ params: idParams }), controller.getOne);
router.post('/', authorize(ROLES.EMPLOYEE), validate({ body: createDailyStatusSchema }), controller.create);
router.put('/:id', validate({ params: idParams, body: updateDailyStatusSchema }), controller.update);

export default router;
