import { z } from 'zod';

export const mealSlotSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);

export const mealEntryKindSchema = z.enum(['RECIPE', 'NOTE']);

export const mealPlanEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  slot: mealSlotSchema,
  kind: mealEntryKindSchema,
  recipeId: z.string().nullable(),
  note: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const deleteMealPlanEntryResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});
