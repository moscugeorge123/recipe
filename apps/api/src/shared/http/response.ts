import { z } from 'zod';

import { paginationMetaSchema, type PaginationMeta } from '../pagination/pagination.js';

/**
 * Response envelope convention.
 *
 * - Resource endpoints return `{ "data": ... }`, and collections add `{ "meta": ... }`.
 *   The envelope means we can add fields (meta, warnings, deprecations) later without
 *   breaking clients that already parse the payload.
 * - Operational endpoints (`/health`) are deliberately *not* wrapped, because load balancers
 *   and container orchestrators expect a flat, minimal document.
 *
 * The `*Schema` builders below are used in route definitions so the OpenAPI document and the
 * runtime serialisation are generated from the same source.
 */

export interface DataResponse<T> {
  data: T;
}

export interface CollectionResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function dataResponse<T>(data: T): DataResponse<T> {
  return { data };
}

export function collectionResponse<T>(items: T[], meta: PaginationMeta): CollectionResponse<T> {
  return { data: items, meta };
}

export function dataResponseSchema<T extends z.ZodType>(schema: T): z.ZodObject<{ data: T }> {
  return z.object({ data: schema });
}

export function collectionResponseSchema<T extends z.ZodType>(
  schema: T,
): z.ZodObject<{ data: z.ZodArray<T>; meta: typeof paginationMetaSchema }> {
  return z.object({
    data: z.array(schema),
    meta: paginationMetaSchema,
  });
}
