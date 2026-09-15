import { z } from 'zod';
import { HALF_DAY_SESSIONS, LEAVE_STATUS, LEAVE_TYPES } from '../../constants/index.js';
import { paginationQuery } from '../../utils/pagination.js';
import { dateOnly, objectId, optionalTrimmed, trimmed } from '../../utils/validators.js';

const MAX_LEAVE_SPAN_DAYS = 90;

const leaveFields = z.object({
  type: z.enum(LEAVE_TYPES, { error: 'Select a leave type' }),
  startDate: dateOnly('Start date'),
  endDate: dateOnly('End date'),
  isHalfDay: z.boolean().default(false),
  halfDaySession: z.enum(HALF_DAY_SESSIONS).nullable().optional(),
  reason: trimmed('Reason', { min: 3, max: 1000 }),
});

function refineLeave(v, ctx) {
  if (v.endDate < v.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before start date' });
    return;
  }
  const span = (new Date(v.endDate) - new Date(v.startDate)) / 86_400_000 + 1;
  if (span > MAX_LEAVE_SPAN_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: `A single request cannot span more than ${MAX_LEAVE_SPAN_DAYS} days`,
    });
  }
  if (v.isHalfDay && v.startDate !== v.endDate) {
    ctx.addIssue({ code: 'custom', path: ['isHalfDay'], message: 'Half-day leave must start and end on the same day' });
  }
  if (v.isHalfDay && !v.halfDaySession) {
    ctx.addIssue({ code: 'custom', path: ['halfDaySession'], message: 'Select which half of the day' });
  }
}

const normalise = (v) => ({ ...v, halfDaySession: v.isHalfDay ? v.halfDaySession : null });

export const leaveSchema = leaveFields.superRefine(refineLeave).transform(normalise);

export const reviewLeaveSchema = z.object({
  status: z.enum([LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED], { error: 'Status must be approved or rejected' }),
  reviewNote: optionalTrimmed('Note', 500),
});

export const listLeavesQuery = z
  .object({
    ...paginationQuery,
    employee: objectId('employee').optional(),
    status: z.enum(Object.values(LEAVE_STATUS)).optional(),
    type: z.enum(LEAVE_TYPES).optional(),
    from: dateOnly('From date').optional(),
    to: dateOnly('To date').optional(),
    sortBy: z.enum(['startDate', 'createdAt', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((v) => !v.from || !v.to || v.to >= v.from, { path: ['to'], message: '"to" must not be before "from"' });

export const summaryQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
