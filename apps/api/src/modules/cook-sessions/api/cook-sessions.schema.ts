import { z } from 'zod';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';

export const cookSessionStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED', 'STOPPED']);

export type CookSessionStatusValue = z.infer<typeof cookSessionStatusSchema>;

export const cookSessionIdParamsSchema = z.object({
  id: z.uuid('id must be a UUID'),
});

export const listCookSessionsQuerySchema = paginationQuerySchema.extend({
  status: cookSessionStatusSchema.optional(),
});

export type ListCookSessionsQuery = z.infer<typeof listCookSessionsQuerySchema>;

export const createCookSessionBodySchema = z
  .object({
    recipeId: z.uuid('recipeId must be a UUID'),
    currentStepIndex: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateCookSessionBody = z.infer<typeof createCookSessionBodySchema>;

export const patchCookSessionBodySchema = z
  .object({
    currentStepIndex: z.number().int().min(0).optional(),
    status: cookSessionStatusSchema.optional(),
  })
  .strict()
  .refine((body) => body.currentStepIndex !== undefined || body.status !== undefined, {
    message: 'At least one of currentStepIndex or status is required',
  });

export type PatchCookSessionBody = z.infer<typeof patchCookSessionBodySchema>;

export const cookSessionRecipeSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  stepCount: z.number().int(),
});

export const cookSessionStepSchema = z.object({
  stepIndex: z.number().int(),
  visitCount: z.number().int(),
  durationMs: z.number().int(),
  firstEnteredAt: z.iso.datetime(),
  lastEnteredAt: z.iso.datetime(),
});

export const cookSessionSchema = z.object({
  id: z.uuid(),
  recipeId: z.uuid(),
  status: cookSessionStatusSchema,
  currentStepIndex: z.number().int(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  totalDurationMs: z.number().int(),
  steps: z.array(cookSessionStepSchema),
  recipe: cookSessionRecipeSchema,
});

export const deleteCookSessionResponseSchema = z.object({
  id: z.uuid(),
  deleted: z.literal(true),
});
