import { z } from 'zod';
import { todayDateOnly } from '../../utils/dates.js';
import { paginationQuery } from '../../utils/pagination.js';
import { dateOnly, objectId, optionalTrimmed, trimmed } from '../../utils/validators.js';

const contentFields = {
  workDone: trimmed('Work done', { min: 3, max: 5000 }),
  planNext: optionalTrimmed('Plan for next day', 3000),
  blockers: optionalTrimmed('Blockers', 2000),
  hoursWorked: z.number().min(0, 'Hours cannot be negative').max(24, 'Hours cannot exceed 24').nullable().optional(),
};

export const createDailyStatusSchema = z.object({
  // Checked lazily so "today" is evaluated per request, not at boot.
  date: dateOnly('Date').refine((d) => d <= todayDateOnly(), { message: 'You cannot submit a report for a future date' }),
  ...contentFields,
});

export const updateDailyStatusSchema = z.object(contentFields);

export const listDailyStatusQuery = z
  .object({
    ...paginationQuery,
    employee: objectId('employee').optional(),
    from: dateOnly('From date').optional(),
    to: dateOnly('To date').optional(),
    search: z.string().trim().max(100).optional(),
    /** Reviewers can ask for only their own reports. */
    scope: z.enum(['mine', 'all']).optional(),
  })
  .refine((v) => !v.from || !v.to || v.to >= v.from, { path: ['to'], message: '"to" must not be before "from"' });

export const teamBoardQuery = z.object({
  date: dateOnly('Date').optional(),
  department: z.string().trim().max(80).optional(),
});
