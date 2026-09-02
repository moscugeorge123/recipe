import { z } from 'zod';

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
      reason: z.enum([
        'budget',
        'ai_unavailable',
        'malformed',
        'low_confidence',
      ]),
      retryable: z.boolean(),
    }),
  ),
  meta: z.object({
    promptVersion: z.string(),
    cacheHits: z.number(),
    dictionaryHits: z.number(),
    aiItemCount: z.number(),
    modelsUsed: z.array(z.string()),
    escalatedCount: z.number(),
    fallbackCount: z.number(),
    truncated: z.boolean(),
    aiAvailable: z.boolean(),
  }),
});

export const pantryItemSchema = z.object({
  id: z.string(),
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
  storageLocation: z.enum(['PANTRY', 'FRIDGE', 'FREEZER', 'OTHER']),
  expiresAt: z.string().nullable(),
  classification: z.object({
    status: z.string(),
    canonicalName: z.string().optional(),
    category: z.string().optional(),
    confidence: z.number().optional(),
    source: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
