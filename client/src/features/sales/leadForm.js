import { z } from 'zod';

export function optionFor(field, value) {
  return field?.options?.find((o) => o.value === value);
}

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Builds a client-side zod schema mirroring the server's dynamic validation. */
export function buildLeadSchema(fields) {
  const shape = {};
  for (const field of fields) {
    const label = field.label;
    let schema = z.any().superRefine((value, ctx) => {
      const fail = (message) => ctx.addIssue({ code: 'custom', message });
      if (field.type === 'checkbox') {
        if (field.required && !value) fail(`${label} is required`);
        return;
      }
      if (isBlank(value)) {
        if (field.required) fail(`${label} is required`);
        return;
      }
      const str = String(value).trim();
      switch (field.type) {
        case 'text':
          if (str.length > 300) fail(`${label} must be at most 300 characters`);
          break;
        case 'textarea':
          if (str.length > 5000) fail(`${label} must be at most 5000 characters`);
          break;
        case 'email':
          if (!z.email().safeParse(str).success) fail('Enter a valid email address');
          break;
        case 'phone':
          if (!/^[+\d\s()-]{5,20}$/.test(str)) fail('Enter a valid phone number');
          break;
        case 'url':
          try {
            const u = new URL(str);
            if (!['http:', 'https:'].includes(u.protocol)) fail('URL must start with http:// or https://');
          } catch {
            fail('Enter a valid URL (https://…)');
          }
          break;
        case 'number':
        case 'currency':
          if (!Number.isFinite(Number(str))) fail(`${label} must be a number`);
          else if (field.type === 'currency' && Number(str) < 0) fail(`${label} cannot be negative`);
          break;
        default:
          break;
      }
    });
    shape[field.key] = schema;
  }
  return z.object({ data: z.object(shape), owner: z.string().optional() });
}

/** Normalises form values into the API payload shape. */
export function toLeadPayload(fields, data) {
  const out = {};
  for (const field of fields) {
    const value = data[field.key];
    if (field.type === 'checkbox') out[field.key] = Boolean(value);
    else if (isBlank(value)) out[field.key] = null;
    else if (field.type === 'number' || field.type === 'currency') out[field.key] = Number(value);
    else out[field.key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

export function initialLeadValues(fields, lead) {
  const data = {};
  for (const field of fields) {
    const stored = lead?.data?.[field.key];
    if (lead) data[field.key] = stored ?? (field.type === 'checkbox' ? false : '');
    else data[field.key] = field.defaultValue ?? (field.type === 'checkbox' ? false : '');
  }
  return data;
}
