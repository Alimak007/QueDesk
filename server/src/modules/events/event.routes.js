import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './event.controller.js';
import { eventSchema, listEventsQuery, upcomingEventsQuery } from './event.validation.js';

const router = Router();
const canView = requirePermission('calendar', 'view');

router.use(authenticate);

// The company calendar is shared: anyone with calendar access sees every event.
router.get('/', canView, validate({ query: listEventsQuery }), controller.list);
router.get('/upcoming', canView, validate({ query: upcomingEventsQuery }), controller.upcoming);
router.get('/:id', canView, validate({ params: idParams }), controller.getOne);

router.post('/', requirePermission('calendar', 'create'), validate({ body: eventSchema }), controller.create);
router.put('/:id', requirePermission('calendar', 'edit'), validate({ params: idParams, body: eventSchema }), controller.update);
router.delete('/:id', requirePermission('calendar', 'delete'), validate({ params: idParams }), controller.remove);

export default router;
