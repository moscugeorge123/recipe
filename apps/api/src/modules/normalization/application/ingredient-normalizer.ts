import { Prisma } from '@prisma/client';

import type { ExtractedIngredient } from '../../recipes/domain/types.js';
import { isEnglishOutputLanguage } from '../../recipes/prompts/recipe-extraction-v1.js';
import { toSentenceCase } from '../domain/casing.js';
import { categorizeIngredient, isIngredientCategory } from '../domain/presentation-heuristics.js';
import {
  normalizeIngredientName,
  normalizeUnit,
  parseQuantity,
} from '../domain/units.js';

export class IngredientNormalizer {
  normalize(
    ingredient: ExtractedIngredient,
    sortOrder: number,
    outputLanguage = 'en',
  ): {
    name: string;
    canonicalName: string;
    quantity: Prisma.Decimal | null;
    unit: string | null;
    preparation: string | null;
    optional: boolean;
    category: string;
    confidence: number;
    provenance: Record<string, unknown>;
    warnings: string[];
    sortOrder: number;
  } {
    const warnings: string[] = [];
    const trimmedName = ingredient.name.trim();
    const canonicalName = isEnglishOutputLanguage(outputLanguage)
      ? normalizeIngredientName(trimmedName)
      : trimmedName.toLocaleLowerCase();
    const unit = isEnglishOutputLanguage(outputLanguage)
      ? normalizeUnit(ingredient.unit)
      : ingredient.unit?.trim() || null;
    const qty = parseQuantity(ingredient.quantity);

    if (ingredient.quantity && qty === null) {
      warnings.push(`Could not parse quantity "${ingredient.quantity}"`);
    }

    if (!ingredient.quantity && !ingredient.optional) {
      warnings.push('Missing quantity');
    }

    return {
      name: toSentenceCase(ingredient.name),
      canonicalName,
      quantity: qty !== null ? new Prisma.Decimal(qty) : null,
      unit,
      preparation: ingredient.preparation?.trim() ?? null,
      optional: ingredient.optional ?? false,
      category: isIngredientCategory(ingredient.category)
        ? ingredient.category
        : categorizeIngredient(trimmedName),
      confidence: ingredient.confidence,
      provenance: ingredient.provenance ? { source: ingredient.provenance } : {},
      warnings,
      sortOrder,
    };
  }
}
