import { z } from 'zod';

export const shoppingListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  canonicalName: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string().nullable(),
  emoji: z.string().nullable(),
  done: z.boolean(),
  fromRecipeCount: z.number(),
  source: z.enum(['MANUAL', 'RECIPE', 'MEAL_PLAN']),
  sourceRecipeId: z.string().nullable(),
  sourceMealPlanEntryId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const deleteShoppingListItemResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

export const clearDoneShoppingListResponseSchema = z.object({
  deleted: z.literal(true),
  count: z.number().int().nonnegative(),
});
