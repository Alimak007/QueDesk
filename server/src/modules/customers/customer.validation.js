import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';
import { objectId } from '../../utils/validators.js';
import { recordData } from '../sales/sales.validation.js';

export const createCustomerSchema = z.object({
  data: recordData,
  owner: objectId('owner').optional(),
});

export const updateCustomerSchema = z
  .object({
    data: recordData.optional(),
    owner: objectId('owner').optional(),
  })
  .refine((v) => v.data || v.owner, { message: 'Nothing to update' });

export const listCustomersQuery = z.object({
  ...paginationQuery,
  search: z.string().trim().max(100).optional(),
  owner: objectId('owner').optional(),
  status: z.string().trim().max(60).optional(),
  source: z.enum(['manual', 'lead']).optional(),
  sortBy: z.string().regex(/^(createdAt|updatedAt|data\.[a-z][a-zA-Z0-9]{0,39})$/).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
