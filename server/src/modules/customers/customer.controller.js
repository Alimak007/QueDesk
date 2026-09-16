import { created, noContent, ok } from '../../utils/response.js';
import * as customerService from './customer.service.js';

export async function list(req, res) {
  return ok(res, await customerService.listCustomers(req.valid.query));
}

export async function getOne(req, res) {
  return ok(res, { customer: await customerService.getCustomer(req.valid.params.id) });
}

export async function create(req, res) {
  return created(res, { customer: await customerService.createCustomer(req.valid.body, req.user) });
}

export async function update(req, res) {
  return ok(res, { customer: await customerService.updateCustomer(req.valid.params.id, req.valid.body, req.user) });
}

export async function remove(req, res) {
  await customerService.deleteCustomer(req.valid.params.id, req.user);
  return noContent(res);
}
