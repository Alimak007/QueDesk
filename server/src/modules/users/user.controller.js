import { created, noContent, ok } from '../../utils/response.js';
import * as userService from './user.service.js';

export async function list(req, res) {
  return ok(res, await userService.listUsers(req.valid.query));
}

export async function directory(_req, res) {
  return ok(res, { items: await userService.listDirectory() });
}

export async function departments(_req, res) {
  return ok(res, { items: await userService.listDepartments() });
}

export async function getOne(req, res) {
  const [user, history] = await Promise.all([
    userService.getUser(req.valid.params.id),
    userService.getUserHistorySummary(req.valid.params.id),
  ]);
  return ok(res, { user, history });
}

export async function create(req, res) {
  return created(res, { user: await userService.createUser(req.valid.body) });
}

export async function update(req, res) {
  return ok(res, { user: await userService.updateUser(req.valid.params.id, req.valid.body, req.user) });
}

export async function updateStatus(req, res) {
  const user = await userService.setUserStatus(req.valid.params.id, req.valid.body.status, req.user);
  return ok(res, { user });
}

export async function resetPassword(req, res) {
  await userService.resetPassword(req.valid.params.id, req.valid.body.password);
  return ok(res, { reset: true });
}

export async function remove(req, res) {
  await userService.deleteUser(req.valid.params.id, req.user);
  return noContent(res);
}
