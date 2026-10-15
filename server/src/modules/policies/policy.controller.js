import { created, noContent, ok } from '../../utils/response.js';
import * as policyService from './policy.service.js';

export async function list(req, res) {
  return ok(res, { items: await policyService.listPolicies(req.valid.query, req.user) });
}

export async function pending(req, res) {
  return ok(res, { items: await policyService.listPendingPolicies(req.user) });
}

export async function getOne(req, res) {
  return ok(res, { policy: await policyService.getPolicy(req.valid.params.id, req.user) });
}

export async function acceptances(req, res) {
  return ok(res, await policyService.listAcceptances(req.valid.params.id));
}

export async function create(req, res) {
  return created(res, { policy: await policyService.createPolicy(req.valid.body, req.user) });
}

export async function update(req, res) {
  return ok(res, { policy: await policyService.updatePolicy(req.valid.params.id, req.valid.body, req.user) });
}

export async function setStatus(req, res) {
  return ok(res, { policy: await policyService.setPolicyStatus(req.valid.params.id, req.valid.body.status, req.user) });
}

export async function remove(req, res) {
  await policyService.deletePolicy(req.valid.params.id, req.user);
  return noContent(res);
}

export async function accept(req, res) {
  return ok(res, await policyService.acceptPolicies(req.user, req.valid.body));
}
