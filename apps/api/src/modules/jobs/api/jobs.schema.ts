import { z } from 'zod';

import { dbUuid } from '../../../shared/validation/uuid.js';

export const createExtractionJobBodySchema = z
  .object({
    url: z.url('url must be a valid URL'),
    outputLanguage: z.string().min(2).max(10).default('en'),
    forceRefresh: z.boolean().default(false),
    // Unknown option keys (e.g. the retired `extractNutrition`) are stripped, not rejected,
    // so older clients keep working. Calories and macros are always extracted now.
    options: z
      .object({
        extractImages: z.boolean().default(true),
        highAccuracy: z.boolean().default(false),
        selectedThumbnailUrl: z.url().optional(),
      })
      .default({ extractImages: true, highAccuracy: false }),
  })
  .strict();

export const previewLinkBodySchema = z
  .object({
    url: z.url('url must be a valid URL'),
  })
  .strict();

export const linkPreviewResponseSchema = z.object({
  url: z.string(),
  sourceType: z.enum(['INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'TIKTOK', 'GENERIC_WEB']),
  title: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  thumbnails: z.array(z.object({ url: z.string() })),
});

export const jobIdParamsSchema = z.object({
  id: dbUuid('id must be a UUID'),
});

export const extractionJobResponseSchema = z.object({
  jobId: dbUuid(),
  status: z.enum(['queued', 'completed']),
  recipeId: dbUuid().optional(),
  deduplicated: z.boolean().optional(),
});

export const jobStatusResponseSchema = z.object({
  id: dbUuid(),
  status: z.string(),
  progress: z.number().int(),
  currentStage: z.string().nullable(),
  recipeId: dbUuid().nullable(),
  error: z.unknown().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});

export const cancelJobResponseSchema = z.object({
  id: dbUuid(),
  status: z.literal('CANCELLED'),
});

export type CreateExtractionJobBody = z.infer<typeof createExtractionJobBodySchema>;
export type PreviewLinkBody = z.infer<typeof previewLinkBodySchema>;
