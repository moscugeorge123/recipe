import { z } from 'zod';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';
import { dbUuid } from '../../../shared/validation/uuid.js';
import { recipeListItemSchema } from '../../recipes/api/recipes.schema.js';

export const collectionIdParamsSchema = z.object({
  id: dbUuid('id must be a UUID'),
});

export const collectionRecipeParamsSchema = collectionIdParamsSchema.extend({
  recipeId: dbUuid('recipeId must be a UUID'),
});

export const listCollectionsQuerySchema = paginationQuerySchema;

export type ListCollectionsQuery = z.infer<typeof listCollectionsQuerySchema>;

export const createCollectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280).nullable().optional(),
    recipeIds: z.array(dbUuid('recipeId must be a UUID')).max(100).optional(),
  })
  .strict();

export type CreateCollectionBody = z.infer<typeof createCollectionBodySchema>;

export const patchCollectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(280).nullable().optional(),
  })
  .strict()
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    message: 'At least one of name or description is required',
  });

export type PatchCollectionBody = z.infer<typeof patchCollectionBodySchema>;

export const addCollectionRecipeBodySchema = z
  .object({
    recipeId: dbUuid('recipeId must be a UUID'),
  })
  .strict();

export type AddCollectionRecipeBody = z.infer<typeof addCollectionRecipeBodySchema>;

export const reorderCollectionRecipesBodySchema = z
  .object({
    recipeIds: z.array(dbUuid('recipeId must be a UUID')).max(200),
  })
  .strict();

export type ReorderCollectionRecipesBody = z.infer<typeof reorderCollectionRecipesBodySchema>;

export const collectionCoverPreviewSchema = z.object({
  recipeId: dbUuid(),
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
});

export const collectionRecipeSchema = recipeListItemSchema.extend({
  sortOrder: z.number().int(),
});

export const collectionSummarySchema = z.object({
  id: dbUuid(),
  name: z.string(),
  description: z.string().nullable(),
  recipeCount: z.number().int().nonnegative(),
  recipeIds: z.array(dbUuid()),
  coverPreviews: z.array(collectionCoverPreviewSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const collectionDetailSchema = collectionSummarySchema.extend({
  recipes: z.array(collectionRecipeSchema),
});

export const deleteCollectionResponseSchema = z.object({
  id: dbUuid(),
  deleted: z.literal(true),
});
