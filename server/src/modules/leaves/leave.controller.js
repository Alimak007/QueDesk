import { created, ok } from '../../utils/response.js';
import * as leaveService from './leave.service.js';

export async function list(req, res) {
  return ok(res, await leaveService.listLeaves(req.valid.query, req.user));
}

export async function summary(req, res) {
  return ok(res, await leaveService.getLeaveSummary(req.user, req.valid.query));
}

export async function preview(req, res) {
  const days = await leaveService.calculateLeaveDays(req.valid.body);
  return ok(res, { days });
}

export async function getOne(req, res) {
  return ok(res, { leave: await leaveService.getLeave(req.valid.params.id, req.user) });
}

export async function apply(req, res) {
  return created(res, { leave: await leaveService.applyLeave(req.valid.body, req.user) });
}

export async function update(req, res) {
  return ok(res, { leave: await leaveService.updateLeave(req.valid.params.id, req.valid.body, req.user) });
}

export async function cancel(req, res) {
  return ok(res, { leave: await leaveService.cancelLeave(req.valid.params.id, req.user) });
}

export async function review(req, res) {
  return ok(res, { leave: await leaveService.reviewLeave(req.valid.params.id, req.valid.body, req.user) });
}
