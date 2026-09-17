import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './sales.controller.js';
import {
  boardQuery,
  configQuery,
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
const canViewLeads = requirePermission('leads', 'view');

router.use(authenticate);

/*
 * Form configuration (Leads and Customers). Readable by every signed-in user because
 * forms are generated from it; changing it is an Administration → Settings task.
 */
router.get('/config', validate({ query: configQuery }), controller.getConfig);
router.put('/config/settings', adminOnly, validate({ body: salesSettingsSchema }), controller.updateSettings);
router.post('/fields', adminOnly, validate({ body: createFieldSchema }), controller.createField);
router.put('/fields/reorder', adminOnly, validate({ body: reorderFieldsSchema }), controller.reorderFields);
router.patch('/fields/:id', adminOnly, validate({ params: idParams, body: updateFieldSchema }), controller.updateField);
router.patch('/fields/:id/archive', adminOnly, validate({ params: idParams }), controller.archiveField);
router.patch('/fields/:id/restore', adminOnly, validate({ params: idParams }), controller.restoreField);
router.delete('/fields/:id', adminOnly, validate({ params: idParams }), controller.deleteField);

/* Leads: shared across the organisation, gated by module permissions. */
router.get('/leads', canViewLeads, validate({ query: listLeadsQuery }), controller.listLeads);
router.get('/leads/board', canViewLeads, validate({ query: boardQuery }), controller.board);
router.get('/leads/summary', canViewLeads, controller.summary);
router.post('/leads', requirePermission('leads', 'create'), validate({ body: createLeadSchema }), controller.createLead);
router.get('/leads/:id', canViewLeads, validate({ params: idParams }), controller.getLead);
router.patch('/leads/:id', requirePermission('leads', 'edit'), validate({ params: idParams, body: updateLeadSchema }), controller.updateLead);
router.patch('/leads/:id/move', requirePermission('leads', 'edit'), validate({ params: idParams, body: moveLeadSchema }), controller.moveLead);
router.post('/leads/:id/convert', requirePermission('customers', 'create'), validate({ params: idParams }), controller.convertLead);
router.delete('/leads/:id', requirePermission('leads', 'delete'), validate({ params: idParams }), controller.deleteLead);

export default router;
