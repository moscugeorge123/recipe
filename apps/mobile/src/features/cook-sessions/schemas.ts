import { z } from 'zod';

export const cookSessionStatusSchema = z.enum([
  'IN_PROGRESS',
  'COMPLETED',
  'STOPPED',
]);

export const cookSessionStepSchema = z.object({
  stepIndex: z.number().int(),
  visitCount: z.number().int(),
  durationMs: z.number().int(),
  firstEnteredAt: z.string(),
  lastEnteredAt: z.string(),
});

export const cookSessionSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  status: cookSessionStatusSchema,
  currentStepIndex: z.number().int(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  totalDurationMs: z.number().int(),
  steps: z.array(cookSessionStepSchema),
  recipe: z.object({
    id: z.string(),
    title: z.string(),
    stepCount: z.number().int(),
  }),
});

export const deleteCookSessionResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
