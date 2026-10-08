import { z } from 'zod';

import { recipeListItemSchema } from '@/features/recipes/schemas';

export const collectionCoverPreviewSchema = z.object({
  recipeId: z.string(),
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
});

export const collectionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  recipeCount: z.number().int().nonnegative(),
  recipeIds: z.array(z.string()),
  coverPreviews: z.array(collectionCoverPreviewSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const collectionRecipeSchema = recipeListItemSchema.extend({
  sortOrder: z.number().int(),
});

export const collectionDetailSchema = collectionSummarySchema.extend({
  recipes: z.array(collectionRecipeSchema),
});

export const deleteCollectionResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});
