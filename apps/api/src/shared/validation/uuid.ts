import { z } from 'zod';

/**
 * Postgres UUID columns store any 128-bit value. Platform backfill ids are md5
 * formatted as 8-4-4-4-12 hex and often lack RFC 4122 version/variant bits.
 * Zod 4 `z.uuid()` rejects those; `z.guid()` matches the database wire format.
 */
export function dbUuid(message?: string) {
  return message === undefined ? z.guid() : z.guid(message);
}
