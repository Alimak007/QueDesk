import { z } from 'zod';
import { EVENT_TYPES } from '../../constants/index.js';
import { dateOnly, optionalTrimmed, timeOfDay, trimmed } from '../../utils/validators.js';

const eventBody = z.object({
  title: trimmed('Title', { max: 150 }),
  type: z.enum(EVENT_TYPES, { error: 'Select a valid event type' }),
  startDate: dateOnly('Start date'),
  endDate: dateOnly('End date'),
  isAllDay: z.boolean().default(true),
  startTime: timeOfDay('Start time').nullable().optional(),
  endTime: timeOfDay('End time').nullable().optional(),
  description: optionalTrimmed('Description', 3000),
  location: optionalTrimmed('Location', 200),
  additionalInfo: optionalTrimmed('Additional information', 2000),
});

function refineEvent(v, ctx) {
  if (v.endDate < v.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before start date' });
  }
  if (!v.isAllDay) {
    if (!v.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Start time is required' });
    if (!v.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time is required' });
    if (v.startTime && v.endTime && v.startDate === v.endDate && v.endTime <= v.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
    }
  }
}

export const eventSchema = eventBody.superRefine(refineEvent).transform((v) => ({
  ...v,
  startTime: v.isAllDay ? null : v.startTime,
  endTime: v.isAllDay ? null : v.endTime,
}));

export const listEventsQuery = z
  .object({
    from: dateOnly('From date'),
    to: dateOnly('To date'),
    type: z.enum(EVENT_TYPES).optional(),
  })
  .refine((v) => v.to >= v.from, { path: ['to'], message: '"to" must not be before "from"' })
  .refine((v) => (new Date(v.to) - new Date(v.from)) / 86_400_000 <= 400, {
    path: ['to'],
    message: 'Date range cannot exceed 400 days',
  });

export const upcomingEventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
  type: z.enum(EVENT_TYPES).optional(),
});
