import { created, noContent, ok } from '../../utils/response.js';
import { isAdmin } from '../../utils/scope.js';
import * as leadService from './lead.service.js';
import * as fieldService from './salesField.service.js';
import { getSalesSettings } from './salesSettings.model.js';
import { convertLeadToCustomer } from '../customers/customer.service.js';

/* ----------------------------- Configuration ----------------------------- */

export async function getConfig(req, res) {
  const { entity } = req.valid.query;
  const includeArchived = isAdmin(req.user) && req.valid.query.includeArchived === 'true';
  const [fields, settings] = await Promise.all([fieldService.listFields({ entity, includeArchived }), getSalesSettings()]);
  return ok(res, { entity, fields, settings });
}

export async function createField(req, res) {
  return created(res, { field: await fieldService.createField(req.valid.body) });
}

export async function updateField(req, res) {
  return ok(res, { field: await fieldService.updateField(req.valid.params.id, req.valid.body) });
}

export async function archiveField(req, res) {
  return ok(res, { field: await fieldService.setArchived(req.valid.params.id, true) });
}

export async function restoreField(req, res) {
  return ok(res, { field: await fieldService.setArchived(req.valid.params.id, false) });
}

export async function deleteField(req, res) {
  await fieldService.deleteField(req.valid.params.id);
  return noContent(res);
}

export async function reorderFields(req, res) {
  return ok(res, { fields: await fieldService.reorderFields(req.valid.body.entity, req.valid.body.ids) });
}

export async function updateSettings(req, res) {
  return ok(res, { settings: await fieldService.updateSettings(req.valid.body, req.user) });
}

/* --------------------------------- Leads --------------------------------- */

export async function listLeads(req, res) {
  return ok(res, await leadService.listLeads(req.valid.query));
}

export async function board(req, res) {
  return ok(res, await leadService.getBoard(req.valid.query));
}

export async function summary(_req, res) {
  return ok(res, await leadService.getSalesSummary());
}

export async function getLead(req, res) {
  return ok(res, { lead: await leadService.getLead(req.valid.params.id) });
}

export async function createLead(req, res) {
  return created(res, { lead: await leadService.createLead(req.valid.body, req.user) });
}

export async function updateLead(req, res) {
  return ok(res, { lead: await leadService.updateLead(req.valid.params.id, req.valid.body, req.user) });
}

export async function moveLead(req, res) {
  return ok(res, { lead: await leadService.moveLead(req.valid.params.id, req.valid.body, req.user) });
}

export async function deleteLead(req, res) {
  await leadService.deleteLead(req.valid.params.id);
  return noContent(res);
}

export async function convertLead(req, res) {
  const { customer, created: isNew } = await convertLeadToCustomer(req.valid.params.id, req.user);
  return isNew ? created(res, { customer, created: true }) : ok(res, { customer, created: false });
}
