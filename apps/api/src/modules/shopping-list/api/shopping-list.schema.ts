import { z } from 'zod';

import { GROCERY_CATEGORIES, ShoppingListSource } from '@recipe/contracts';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';
import { dbUuid } from '../../../shared/validation/uuid.js';
import { isOneEmoji } from '../../normalization/domain/presentation.js';

const shoppingListSourceValues = [
  ShoppingListSource.MANUAL,
  ShoppingListSource.RECIPE,
  ShoppingListSource.MEAL_PLAN,
] as const;

const groceryCategorySchema = z.enum(GROCERY_CATEGORIES);

export const shoppingListItemIdParamsSchema = z.object({
  id: dbUuid('id must be a UUID'),
});

export const listShoppingListQuerySchema = paginationQuerySchema.extend({
  done: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export type ListShoppingListQuery = z.infer<typeof listShoppingListQuerySchema>;

export const shoppingListItemWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    quantity: z.number().nonnegative().nullable().optional(),
    unit: z.string().trim().min(1).max(40).nullable().optional(),
    category: groceryCategorySchema.optional(),
    emoji: z.string().refine(isOneEmoji, 'emoji must be one grapheme').optional(),
    sourceRecipeId: dbUuid('sourceRecipeId must be a UUID').optional(),
  })
  .strict();

export const createShoppingListItemsBodySchema = z
  .object({
    items: z.array(shoppingListItemWriteSchema).min(1).max(50),
  })
  .strict();

export type CreateShoppingListItemsBody = z.infer<typeof createShoppingListItemsBodySchema>;

export const fromRecipeBodySchema = z
  .object({
    recipeId: dbUuid('recipeId must be a UUID'),
    servings: z.number().positive().optional(),
  })
  .strict();

export type FromRecipeBody = z.infer<typeof fromRecipeBodySchema>;

export const patchShoppingListItemBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    quantity: z.number().nonnegative().nullable().optional(),
    unit: z.string().trim().min(1).max(40).nullable().optional(),
    done: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });

export type PatchShoppingListItemBody = z.infer<typeof patchShoppingListItemBodySchema>;

export const shoppingListItemSchema = z.object({
  id: dbUuid(),
  name: z.string(),
  canonicalName: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string().nullable(),
  emoji: z.string().nullable(),
  done: z.boolean(),
  fromRecipeCount: z.number().int(),
  source: z.enum(shoppingListSourceValues),
  sourceRecipeId: dbUuid().nullable(),
  sourceMealPlanEntryId: dbUuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const deleteShoppingListItemResponseSchema = z.object({
  id: dbUuid(),
  deleted: z.literal(true),
});

export const clearDoneShoppingListResponseSchema = z.object({
  deleted: z.literal(true),
  count: z.number().int().nonnegative(),
});
