import { z } from 'zod';

/**
 * Reusable, transport-agnostic pagination.
 *
 * Page/pageSize is what a mobile list view needs, while `toOffsetLimit` produces the
 * shape a database driver or ORM wants later. No storage-specific concerns live here.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('page must be an integer')
    .min(1, 'page must be 1 or greater')
    .default(1),
  pageSize: z.coerce
    .number()
    .int('pageSize must be an integer')
    .min(1, 'pageSize must be 1 or greater')
    .max(MAX_PAGE_SIZE, `pageSize must not exceed ${String(MAX_PAGE_SIZE)}`)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Translates page-based input into the offset/limit pair used by most data stores. */
export function toOffsetLimit(pagination: PaginationQuery): { offset: number; limit: number } {
  return {
    offset: (pagination.page - 1) * pagination.pageSize,
    limit: pagination.pageSize,
  };
}

export function buildPaginationMeta(pagination: PaginationQuery, total: number): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pagination.pageSize),
  };
}
