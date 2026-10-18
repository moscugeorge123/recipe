import { z } from 'zod';

export const linkPreviewThumbnailSchema = z.object({
  url: z.string(),
});

export const linkPreviewSchema = z.object({
  url: z.string(),
  sourceType: z.enum([
    'INSTAGRAM',
    'YOUTUBE',
    'FACEBOOK',
    'TIKTOK',
    'GENERIC_WEB',
  ]),
  title: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  thumbnails: z.array(linkPreviewThumbnailSchema),
  /** Websites only: whether the page reads like a recipe. Null or absent when unknown. */
  looksLikeRecipe: z.boolean().nullish(),
});

export type LinkPreview = z.infer<typeof linkPreviewSchema>;
