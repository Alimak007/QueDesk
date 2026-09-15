import { z } from 'zod';
import { isValidDateOnly, TIME_REGEX } from './dates.js';
import { isObjectId } from './mongoose.js';

export const objectId = (label = 'id') =>
  z.string().refine(isObjectId, { message: `Invalid ${label}` });

export const idParams = z.object({ id: objectId() });

export const dateOnly = (label = 'Date') =>
  z.string({ error: `${label} is required` }).refine(isValidDateOnly, {
    message: `${label} must be a valid date (YYYY-MM-DD)`,
  });

export const timeOfDay = (label = 'Time') =>
  z.string().regex(TIME_REGEX, `${label} must be in HH:mm format`);

export const trimmed = (label, { min = 1, max = 200 } = {}) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalTrimmed = (label, max = 200) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`).optional();

/** Accepts `true`/`false` query strings. */
export const booleanQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
