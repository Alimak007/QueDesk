import { created, ok } from '../../utils/response.js';
import * as dailyStatusService from './dailyStatus.service.js';

export async function list(req, res) {
  return ok(res, await dailyStatusService.listReports(req.valid.query, req.user));
}

export async function teamBoard(req, res) {
  return ok(res, await dailyStatusService.getTeamBoard(req.valid.query));
}

export async function getOne(req, res) {
  return ok(res, { report: await dailyStatusService.getReport(req.valid.params.id, req.user) });
}

export async function create(req, res) {
  return created(res, { report: await dailyStatusService.createReport(req.valid.body, req.user) });
}

export async function update(req, res) {
  const report = await dailyStatusService.updateReport(req.valid.params.id, req.valid.body, req.user);
  return ok(res, { report });
}
