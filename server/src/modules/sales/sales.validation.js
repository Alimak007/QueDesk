import { z } from 'zod';
import { FIELD_ENTITIES, SALES_FIELD_TYPES } from '../../constants/index.js';
import { paginationQuery } from '../../utils/pagination.js';
import { objectId, optionalTrimmed, trimmed } from '../../utils/validators.js';

export const FIELD_KEY_REGEX = /^[a-z][a-zA-Z0-9]{0,39}$/;
export const OPTION_COLORS = ['slate', 'blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'teal', 'cyan'];

const optionSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, 'Option value is required')
    .max(60)
    .regex(/^[a-z0-9_-]+$/, 'Option values may only contain lowercase letters, numbers, - and _'),
  label: trimmed('Option label', { max: 60 }),
  color: z.enum(OPTION_COLORS).default('slate'),
});

const fieldCommon = {
  label: trimmed('Label', { max: 60 }),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).optional(),
  placeholder: optionalTrimmed('Placeholder', 120),
  helpText: optionalTrimmed('Help text', 200),
  options: z.array(optionSchema).max(50, 'A field can have at most 50 options').optional(),
  isVisible: z.boolean().optional(),
  showInList: z.boolean().optional(),
};

function refineOptions(v, ctx) {
  if (!v.options) return;
  const seen = new Set();
  v.options.forEach((o, i) => {
    if (seen.has(o.value)) {
      ctx.addIssue({ code: 'custom', path: ['options', i, 'value'], message: `Duplicate option value "${o.value}"` });
    }
    seen.add(o.value);
  });
}

export const createFieldSchema = z
  .object({
    ...fieldCommon,
    key: z
      .string()
      .trim()
      .regex(FIELD_KEY_REGEX, 'Key must start with a lowercase letter and contain only letters and numbers')
      .optional(),
    type: z.enum(SALES_FIELD_TYPES, { error: 'Select a valid field type' }),
    entity: z.enum(FIELD_ENTITIES).default('lead'),
  })
  .superRefine((v, ctx) => {
    refineOptions(v, ctx);
    if (v.type === 'dropdown' && !v.options?.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Dropdown fields need at least one option' });
    }
  });

export const updateFieldSchema = z
  .object({ ...fieldCommon, label: fieldCommon.label.optional() })
  .superRefine(refineOptions);

export const reorderFieldsSchema = z.object({
  ids: z.array(objectId('field id')).min(1).max(200),
  entity: z.enum(FIELD_ENTITIES).default('lead'),
});

export const configQuery = z.object({
  entity: z.enum(FIELD_ENTITIES).default('lead'),
  includeArchived: z.enum(['true', 'false']).optional(),
});

export const salesSettingsSchema = z.object({
  kanbanGroupField: z.string().regex(FIELD_KEY_REGEX, 'Invalid field').optional(),
  valueField: z.string().regex(FIELD_KEY_REGEX, 'Invalid field').nullable().optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
    .transform((s) => s.toUpperCase())
    .optional(),
});

export const recordData = z.record(z.string().regex(FIELD_KEY_REGEX), z.unknown(), { error: 'Record data must be an object' });

export const createLeadSchema = z.object({
  data: recordData,
  owner: objectId('owner').optional(),
});

export const updateLeadSchema = z
  .object({
    data: recordData.optional(),
    owner: objectId('owner').optional(),
  })
  .refine((v) => v.data || v.owner, { message: 'Nothing to update' });

export const moveLeadSchema = z.object({
  value: z.string().trim().max(60).nullable(),
  position: z.number().finite().optional(),
});

export const listLeadsQuery = z.object({
  ...paginationQuery,
  search: z.string().trim().max(100).optional(),
  owner: objectId('owner').optional(),
  group: z.string().trim().max(60).optional(),
  /** Active leads are still in the pipeline; converted ones became customers. */
  state: z.enum(['active', 'converted']).optional(),
  sortBy: z.string().regex(/^(createdAt|updatedAt|data\.[a-z][a-zA-Z0-9]{0,39})$/).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const boardQuery = z.object({
  search: z.string().trim().max(100).optional(),
  owner: objectId('owner').optional(),
});
