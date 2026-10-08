import { z } from 'zod';

import { GROCERY_CATEGORIES } from '@recipe/contracts';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';
import { dbUuid } from '../../../shared/validation/uuid.js';
import { GARDEN_PLATE_COLOR_TOKENS, isOneEmoji } from '../../normalization/domain/presentation.js';

export const pantryItemIdParamsSchema = z.object({
  id: dbUuid('id must be a UUID'),
});

const groceryCategorySchema = z.enum(GROCERY_CATEGORIES);
const storageLocationSchema = z.enum(['PANTRY', 'FRIDGE', 'FREEZER', 'OTHER']);
const classificationStatusSchema = z.enum([
  'UNCLASSIFIED',
  'PENDING',
  'CLASSIFIED',
  'NEEDS_REVIEW',
  'FAILED',
]);

export const listPantryQuerySchema = paginationQuerySchema.extend({
  category: groceryCategorySchema.optional(),
});

export type ListPantryQuery = z.infer<typeof listPantryQuerySchema>;

const colorTokenSchema = z.enum(GARDEN_PLATE_COLOR_TOKENS);

export const organizePantryBodySchema = z
  .object({
    text: z.string().min(1).max(8000),
    locale: z.string().trim().min(2).max(16).optional(),
  })
  .strict();

export type OrganizePantryBody = z.infer<typeof organizePantryBodySchema>;

export const pantryItemWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    canonicalName: z.string().trim().min(1).max(200).optional(),
    rawText: z.string().trim().min(1).max(2000).optional(),
    locale: z.string().trim().min(2).max(16).optional(),
    promptVersion: z.string().trim().min(1).max(80).optional(),
    quantity: z.number().nonnegative().nullable().optional(),
    unit: z.string().trim().min(1).max(40).nullable().optional(),
    category: groceryCategorySchema.optional(),
    emoji: z.string().refine(isOneEmoji, 'emoji must be one grapheme').optional(),
    colorToken: colorTokenSchema.optional(),
    storageLocation: storageLocationSchema.optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
    confidence: z.number().min(0).max(1).optional(),
    source: z.enum(['user', 'dictionary', 'cache', 'ai', 'fallback', 'rules']).optional(),
    status: classificationStatusSchema.optional(),
  })
  .strict();

export const createPantryItemsBodySchema = z
  .object({
    items: z.array(pantryItemWriteSchema).min(1).max(50),
  })
  .strict();

export type CreatePantryItemsBody = z.infer<typeof createPantryItemsBodySchema>;

export const patchPantryItemBodySchema = pantryItemWriteSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });

export type PatchPantryItemBody = z.infer<typeof patchPantryItemBodySchema>;

export const pantryClassificationSchema = z.object({
  status: classificationStatusSchema,
  canonicalName: z.string().optional(),
  category: z.string().optional(),
  confidence: z.number().optional(),
  source: z.string().optional(),
});

export const pantryItemSchema = z.object({
  id: dbUuid(),
  name: z.string(),
  canonicalName: z.string().nullable(),
  rawText: z.string().nullable(),
  locale: z.string(),
  promptVersion: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string().nullable(),
  emoji: z.string().nullable(),
  colorToken: z.string().nullable(),
  storageLocation: storageLocationSchema,
  expiresAt: z.iso.datetime().nullable(),
  classification: pantryClassificationSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const organizedPantryItemSchema = z.object({
  rawText: z.string(),
  name: z.string(),
  canonicalName: z.string(),
  category: z.string(),
  emoji: z.string(),
  colorToken: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  confidence: z.number(),
  source: z.enum(['dictionary', 'cache', 'ai', 'fallback']),
  status: z.enum(['CLASSIFIED', 'NEEDS_REVIEW', 'FAILED']),
  locale: z.string(),
  promptVersion: z.string(),
});

export const organizePantryResultSchema = z.object({
  items: z.array(organizedPantryItemSchema),
  unresolved: z.array(
    z.object({
      rawText: z.string(),
      reason: z.enum(['budget', 'ai_unavailable', 'malformed', 'low_confidence']),
      retryable: z.boolean(),
    }),
  ),
  meta: z.object({
    promptVersion: z.string(),
    cacheHits: z.number().int(),
    dictionaryHits: z.number().int(),
    aiItemCount: z.number().int(),
    modelsUsed: z.array(z.string()),
    escalatedCount: z.number().int(),
    fallbackCount: z.number().int(),
    truncated: z.boolean(),
    aiAvailable: z.boolean(),
  }),
});

export const deletePantryItemResponseSchema = z.object({
  id: dbUuid(),
  deleted: z.literal(true),
});
