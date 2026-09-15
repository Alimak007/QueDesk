import { created, noContent, ok } from '../../utils/response.js';
import * as eventService from './event.service.js';

export async function list(req, res) {
  return ok(res, { items: await eventService.listEvents(req.valid.query) });
}

export async function upcoming(req, res) {
  return ok(res, { items: await eventService.listUpcomingEvents(req.valid.query) });
}

export async function getOne(req, res) {
  return ok(res, { event: await eventService.getEvent(req.valid.params.id) });
}

export async function create(req, res) {
  return created(res, { event: await eventService.createEvent(req.valid.body, req.user) });
}

export async function update(req, res) {
  return ok(res, { event: await eventService.updateEvent(req.valid.params.id, req.valid.body, req.user) });
}

export async function remove(req, res) {
  await eventService.deleteEvent(req.valid.params.id);
  return noContent(res);
}
