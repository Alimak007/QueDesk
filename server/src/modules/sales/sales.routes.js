import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './sales.controller.js';
import {
  boardQuery,
  createFieldSchema,
  createLeadSchema,
  listLeadsQuery,
  moveLeadSchema,
  reorderFieldsSchema,
  salesSettingsSchema,
  updateFieldSchema,
  updateLeadSchema,
} from './sales.validation.js';

const router = Router();
const adminOnly = authorize(ROLES.ADMIN);

router.use(authenticate);

/* Configuration: readable by everyone (the form is generated from it), writable by admins. */
router.get('/config', controller.getConfig);
router.put('/config/settings', adminOnly, validate({ body: salesSettingsSchema }), controller.updateSettings);
router.post('/fields', adminOnly, validate({ body: createFieldSchema }), controller.createField);
router.put('/fields/reorder', adminOnly, validate({ body: reorderFieldsSchema }), controller.reorderFields);
router.patch('/fields/:id', adminOnly, validate({ params: idParams, body: updateFieldSchema }), controller.updateField);
router.patch('/fields/:id/archive', adminOnly, validate({ params: idParams }), controller.archiveField);
router.patch('/fields/:id/restore', adminOnly, validate({ params: idParams }), controller.restoreField);
router.delete('/fields/:id', adminOnly, validate({ params: idParams }), controller.deleteField);

/* Leads: shared across the organisation. */
router.get('/leads', validate({ query: listLeadsQuery }), controller.listLeads);
router.get('/leads/board', validate({ query: boardQuery }), controller.board);
router.get('/leads/summary', controller.summary);
router.post('/leads', validate({ body: createLeadSchema }), controller.createLead);
router.get('/leads/:id', validate({ params: idParams }), controller.getLead);
router.patch('/leads/:id', validate({ params: idParams, body: updateLeadSchema }), controller.updateLead);
router.patch('/leads/:id/move', validate({ params: idParams, body: moveLeadSchema }), controller.moveLead);
router.delete('/leads/:id', adminOnly, validate({ params: idParams }), controller.deleteLead);

export default router;
