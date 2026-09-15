import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
};

export function getPagination({ page = 1, limit = 20 }) {
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPage(items, total, { page, limit }) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Escapes user input for safe use inside a RegExp. */
export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
