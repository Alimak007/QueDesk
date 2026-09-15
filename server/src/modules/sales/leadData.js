import { z } from 'zod';
import { isValidDateOnly } from '../../utils/dates.js';
import { ApiError } from '../../utils/ApiError.js';

const TEXT_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'url']);
const emailSchema = z.email();

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Coerces and validates a single value against its field definition.
 * Returns `{ value }` or `{ error }`. Empty values normalise to `null`
 * (or `false` for checkboxes).
 */
export function coerceFieldValue(field, raw) {
  if (field.type === 'checkbox') {
    if (isEmpty(raw)) return { value: false };
    if (typeof raw === 'boolean') return { value: raw };
    if (raw === 'true' || raw === 'false') return { value: raw === 'true' };
    return { error: `${field.label} must be true or false` };
  }

  if (isEmpty(raw)) return { value: null };

  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return { error: `${field.label} must be text` };
      const value = String(raw).trim();
      const max = field.type === 'text' ? 300 : 5000;
      if (value.length > max) return { error: `${field.label} must be at most ${max} characters` };
      return { value };
    }
    case 'email': {
      const value = String(raw).trim().toLowerCase();
      if (!emailSchema.safeParse(value).success) return { error: `${field.label} must be a valid email address` };
      return { value };
    }
    case 'phone': {
      const value = String(raw).trim();
      if (!/^[+\d\s()-]{5,20}$/.test(value)) return { error: `${field.label} must be a valid phone number` };
      return { value };
    }
    case 'url': {
      const value = String(raw).trim();
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
      } catch {
        return { error: `${field.label} must be a valid http(s) URL` };
      }
      return { value };
    }
    case 'number':
    case 'currency': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      if (!Number.isFinite(value)) return { error: `${field.label} must be a number` };
      if (field.type === 'currency' && value < 0) return { error: `${field.label} cannot be negative` };
      return { value: field.type === 'currency' ? Math.round(value * 100) / 100 : value };
    }
    case 'date': {
      if (!isValidDateOnly(raw)) return { error: `${field.label} must be a valid date` };
      return { value: raw };
    }
    case 'dropdown': {
      const value = String(raw);
      if (!field.options.some((o) => o.value === value)) {
        return { error: `${field.label} must be one of: ${field.options.map((o) => o.label).join(', ')}` };
      }
      return { value };
    }
    default:
      return { error: `${field.label} has an unsupported type` };
  }
}

/**
 * Validates submitted lead data against the current (non-archived) field
 * configuration. On create, missing values fall back to configured defaults.
 * Values for archived or unknown fields in the input are ignored; values
 * already stored for archived fields are preserved by the caller.
 */
export function validateLeadData(input, fields, { existing = null } = {}) {
  const result = {};
  const details = [];

  for (const field of fields) {
    const provided = Object.hasOwn(input, field.key);

    // On update, untouched fields keep their stored value.
    if (existing && !provided) continue;

    let raw = provided ? input[field.key] : undefined;
    if (!existing && isEmpty(raw) && !isEmpty(field.defaultValue)) raw = field.defaultValue;

    const { value, error } = coerceFieldValue(field, raw);
    if (error) {
      details.push({ path: `data.${field.key}`, message: error });
      continue;
    }

    // Hidden fields are not on the form, so they cannot be enforced as required.
    const enforceRequired = field.required && field.isVisible !== false;
    const missing = value === null || (field.type === 'checkbox' && value === false);
    if (enforceRequired && missing) {
      details.push({ path: `data.${field.key}`, message: `${field.label} is required` });
      continue;
    }

    result[field.key] = value;
  }

  if (details.length) {
    throw ApiError.badRequest(details[0].message, { code: 'VALIDATION_ERROR', details });
  }

  return existing ? { ...existing, ...result } : result;
}

export function buildSearchText(data, fields) {
  return fields
    .filter((f) => TEXT_TYPES.has(f.type) || f.type === 'dropdown')
    .map((f) => {
      const value = data[f.key];
      if (value === null || value === undefined) return '';
      if (f.type === 'dropdown') return f.options.find((o) => o.value === value)?.label ?? value;
      return String(value);
    })
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .slice(0, 10_000);
}
