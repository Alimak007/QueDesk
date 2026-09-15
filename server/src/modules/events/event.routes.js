import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './event.controller.js';
import { eventSchema, listEventsQuery, upcomingEventsQuery } from './event.validation.js';

const router = Router();
const adminOnly = authorize(ROLES.ADMIN);

router.use(authenticate);

// The company calendar is shared: every signed-in user can read it.
router.get('/', validate({ query: listEventsQuery }), controller.list);
router.get('/upcoming', validate({ query: upcomingEventsQuery }), controller.upcoming);
router.get('/:id', validate({ params: idParams }), controller.getOne);

// Only admins can change it.
router.post('/', adminOnly, validate({ body: eventSchema }), controller.create);
router.put('/:id', adminOnly, validate({ params: idParams, body: eventSchema }), controller.update);
router.delete('/:id', adminOnly, validate({ params: idParams }), controller.remove);

export default router;
