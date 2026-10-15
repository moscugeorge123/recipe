import { z } from 'zod';

import { dbUuid } from '../../../shared/validation/uuid.js';

/** Mirrors `MeResponse` in `@recipe/contracts`. */
export const meSchema = z.object({
  id: dbUuid(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const deleteMeResponseSchema = z.object({ deleted: z.literal(true) });
