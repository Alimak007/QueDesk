import { z } from 'zod';
import { POLICY_CATEGORIES, POLICY_STATUS } from '../../constants/index.js';
import { objectId, optionalTrimmed, trimmed } from '../../utils/validators.js';

const policyFields = {
  title: trimmed('Title', { max: 150 }),
  category: z.enum(POLICY_CATEGORIES, { error: 'Select a category' }),
  summary: optionalTrimmed('Summary', 300),
  content: z
    .string({ error: 'Write the policy text' })
    .trim()
    .min(1, 'Write the policy text')
    .max(50_000, 'The policy text must be at most 50,000 characters'),
  requiresAcceptance: z.boolean().default(true),
  departments: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  /** Publish straight away instead of saving a draft. */
  publish: z.boolean().default(false),
};

export const createPolicySchema = z.object(policyFields);

export const updatePolicySchema = z.object({
  ...policyFields,
  /** The change is significant: everyone must accept the policy again. */
  newVersion: z.boolean().default(false),
});

export const policyStatusSchema = z.object({
  status: z.enum([POLICY_STATUS.PUBLISHED, POLICY_STATUS.ARCHIVED], { error: 'Status must be published or archived' }),
});

export const listPoliciesQuery = z.object({
  status: z.enum(Object.values(POLICY_STATUS)).optional(),
  category: z.enum(POLICY_CATEGORIES).optional(),
  search: z.string().trim().max(100).optional(),
});

export const acceptPoliciesSchema = z.object({
  policies: z
    .array(z.object({ id: objectId('policy'), version: z.number().int().min(1) }))
    .min(1, 'Choose the policies you accept')
    .max(100),
});
