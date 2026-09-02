import { z } from 'zod';

import { dbUuid } from '../../../shared/validation/uuid.js';

export const categoryIdParamsSchema = z.object({
  categoryId: dbUuid('categoryId must be a UUID'),
});

export const categorySchema = z.object({
  id: dbUuid(),
  slug: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  recipeCount: z.number().int().nonnegative(),
  isDefault: z.boolean(),
});

export const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
  })
  .strict();

export const renameCategoryBodySchema = createCategoryBodySchema;

export const assignRecipeCategoriesBodySchema = z
  .object({
    expectedRevisionNumber: z.number().int().nonnegative(),
    categoryIds: z.array(dbUuid()).min(1),
  })
  .strict();
