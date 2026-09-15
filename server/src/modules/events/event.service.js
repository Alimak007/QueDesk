import { ApiError } from '../../utils/ApiError.js';
import { todayDateOnly } from '../../utils/dates.js';
import { Event } from './event.model.js';

const AUTHOR_FIELDS = 'firstName lastName';

export async function listEvents({ from, to, type }) {
  // Any event that overlaps the requested window.
  const filter = { startDate: { $lte: to }, endDate: { $gte: from } };
  if (type) filter.type = type;
  return Event.find(filter).sort({ startDate: 1, startTime: 1 }).populate('createdBy', AUTHOR_FIELDS);
}

export async function listUpcomingEvents({ limit, type }) {
  const filter = { endDate: { $gte: todayDateOnly() } };
  if (type) filter.type = type;
  return Event.find(filter).sort({ startDate: 1, startTime: 1 }).limit(limit);
}

/** Set of holiday dates (YYYY-MM-DD) intersecting the range, used for leave day counts. */
export async function getHolidayDates(from, to) {
  const holidays = await Event.find({ type: 'holiday', startDate: { $lte: to }, endDate: { $gte: from } })
    .select('startDate endDate')
    .lean();

  const dates = new Set();
  for (const h of holidays) {
    const cursor = new Date(`${h.startDate}T00:00:00Z`);
    const end = new Date(`${h.endDate}T00:00:00Z`);
    while (cursor <= end) {
      dates.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return dates;
}

export async function getEvent(id) {
  const event = await Event.findById(id).populate('createdBy', AUTHOR_FIELDS).populate('updatedBy', AUTHOR_FIELDS);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

export async function createEvent(data, actor) {
  const event = await Event.create({ ...data, createdBy: actor._id });
  return event.populate('createdBy', AUTHOR_FIELDS);
}

export async function updateEvent(id, data, actor) {
  const event = await Event.findById(id);
  if (!event) throw ApiError.notFound('Event not found');
  Object.assign(event, data, { updatedBy: actor._id });
  await event.save();
  return event.populate([
    { path: 'createdBy', select: AUTHOR_FIELDS },
    { path: 'updatedBy', select: AUTHOR_FIELDS },
  ]);
}

export async function deleteEvent(id) {
  const event = await Event.findByIdAndDelete(id);
  if (!event) throw ApiError.notFound('Event not found');
}
