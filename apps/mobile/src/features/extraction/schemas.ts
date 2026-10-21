import { z } from 'zod';

export const createExtractionBodySchema = z.object({
  url: z.string(),
  outputLanguage: z.string().optional(),
  forceRefresh: z.boolean().optional(),
  options: z
    .object({
      extractImages: z.boolean().optional(),
      highAccuracy: z.boolean().optional(),
      selectedThumbnailUrl: z.string().optional(),
    })
    .optional(),
});

export const createPhotoExtractionBodySchema = z.object({
  images: z
    .array(z.object({ data: z.string() }))
    .min(1)
    .max(6),
  outputLanguage: z.string().optional(),
});

export const extractionJobCreateSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'completed']),
  recipeId: z.string().optional(),
  deduplicated: z.boolean().optional(),
});

export const jobStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  progress: z.number(),
  currentStage: z.string().nullable(),
  recipeId: z.string().nullable(),
  error: z.unknown().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const jobListItemSchema = z.object({
  id: z.string(),
  status: z.string(),
  progress: z.number(),
  url: z.string(),
  title: z.string().nullable(),
  recipeId: z.string().nullable(),
  error: z.unknown().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const cancelJobSchema = z.object({
  id: z.string(),
  status: z.literal('CANCELLED'),
});

export type ExtractionJobCreate = z.infer<typeof extractionJobCreateSchema>;
export type JobListItemDto = z.infer<typeof jobListItemSchema>;
export type JobStatusDto = z.infer<typeof jobStatusSchema>;
