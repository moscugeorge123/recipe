import { z } from 'zod';

import {
  MEAL_PLAN_NOTE_MAX_LENGTH,
  MealEntryKind,
  MealSlot,
} from '@recipe/contracts';

import { dbUuid } from '../../../shared/validation/uuid.js';

const mealSlotValues = [
  MealSlot.BREAKFAST,
  MealSlot.LUNCH,
  MealSlot.DINNER,
  MealSlot.SNACK,
] as const;

const mealEntryKindValues = [MealEntryKind.RECIPE, MealEntryKind.NOTE] as const;

export const mealSlotSchema = z.enum(mealSlotValues);
export const mealEntryKindSchema = z.enum(mealEntryKindValues);
export const isoDateOnlySchema = z.iso.date();

const noteSchema = z.string().trim().min(1).max(MEAL_PLAN_NOTE_MAX_LENGTH);

export const mealPlanEntryIdParamsSchema = z.object({
  id: dbUuid('id must be a UUID'),
});

export const listMealPlanQuerySchema = z
  .object({
    from: isoDateOnlySchema,
    to: isoDateOnlySchema,
  })
  .strict()
  .refine((query) => query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  })
  .refine(
    (query) => {
      const from = Date.parse(`${query.from}T00:00:00.000Z`);
      const to = Date.parse(`${query.to}T00:00:00.000Z`);
      const days = (to - from) / 86_400_000 + 1;
      return days <= 42;
    },
    {
      message: 'date range must not exceed 42 days',
      path: ['to'],
    },
  );

export type ListMealPlanQuery = z.infer<typeof listMealPlanQuerySchema>;

export const createMealPlanEntryBodySchema = z
  .object({
    date: isoDateOnlySchema,
    slot: mealSlotSchema,
    kind: mealEntryKindSchema,
    recipeId: dbUuid('recipeId must be a UUID').optional(),
    note: noteSchema.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.kind === MealEntryKind.RECIPE && body.recipeId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['recipeId'],
        message: 'recipeId is required when kind is RECIPE',
      });
    }
    if (body.kind === MealEntryKind.NOTE && body.note === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'note is required when kind is NOTE',
      });
    }
    if (body.kind === MealEntryKind.NOTE && body.recipeId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['recipeId'],
        message: 'recipeId is not allowed when kind is NOTE',
      });
    }
  });

export type CreateMealPlanEntryBody = z.infer<typeof createMealPlanEntryBodySchema>;

export const patchMealPlanEntryBodySchema = z
  .object({
    date: isoDateOnlySchema.optional(),
    slot: mealSlotSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    note: noteSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });

export type PatchMealPlanEntryBody = z.infer<typeof patchMealPlanEntryBodySchema>;

const reorderEntrySchema = z
  .object({
    id: dbUuid('id must be a UUID'),
    date: isoDateOnlySchema,
    slot: mealSlotSchema,
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .strict();

export const reorderMealPlanBodySchema = z.union([
  z
    .object({
      ids: z.array(dbUuid('id must be a UUID')).min(1).max(200),
    })
    .strict(),
  z
    .object({
      entries: z.array(reorderEntrySchema).min(1).max(200),
    })
    .strict(),
]);

export type ReorderMealPlanBody = z.infer<typeof reorderMealPlanBodySchema>;

export const mealPlanEntrySchema = z.object({
  id: dbUuid(),
  date: isoDateOnlySchema,
  slot: mealSlotSchema,
  kind: mealEntryKindSchema,
  recipeId: dbUuid().nullable(),
  note: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const deleteMealPlanEntryResponseSchema = z.object({
  id: dbUuid(),
  deleted: z.literal(true),
});
