import { Prisma } from '@prisma/client';

import type { ExtractedIngredient } from '../../recipes/domain/types.js';
import { isEnglishOutputLanguage } from '../../recipes/prompts/recipe-extraction-v1.js';
import { toSentenceCase } from '../domain/casing.js';
import { reconcileMeasurements, type Measurement } from '../domain/measurement-conversion.js';
import { resolveIngredientPresentation } from '../domain/presentation.js';
import { normalizeIngredientName, normalizeUnit, parseQuantity } from '../domain/units.js';

export { isOneEmoji } from '../domain/presentation.js';

function toDecimal(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

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
    metricQuantity: Prisma.Decimal | null;
    metricUnit: string | null;
    imperialQuantity: Prisma.Decimal | null;
    imperialUnit: string | null;
    preparation: string | null;
    optional: boolean;
    emoji: string;
    colorToken: string;
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

    const presentation = resolveIngredientPresentation({
      name: trimmedName,
      category: ingredient.category,
      emoji: ingredient.emoji,
      colorToken: ingredient.colorToken,
    });

    const measurements = reconcileMeasurements(
      { quantity: qty, unit },
      ingredient.metric,
      ingredient.imperial,
    );

    return {
      name: toSentenceCase(ingredient.name),
      canonicalName,
      quantity: toDecimal(qty),
      unit,
      ...measurementColumns(measurements.metric, measurements.imperial),
      preparation: ingredient.preparation?.trim() ?? null,
      optional: ingredient.optional ?? false,
      emoji: presentation.emoji,
      colorToken: presentation.colorToken,
      category: presentation.category,
      confidence: ingredient.confidence,
      provenance: ingredient.provenance ? { source: ingredient.provenance } : {},
      warnings,
      sortOrder,
    };
  }
}

export function measurementColumns(
  metric: Measurement,
  imperial: Measurement,
): {
  metricQuantity: Prisma.Decimal | null;
  metricUnit: string | null;
  imperialQuantity: Prisma.Decimal | null;
  imperialUnit: string | null;
} {
  return {
    metricQuantity: toDecimal(metric.quantity),
    metricUnit: metric.unit,
    imperialQuantity: toDecimal(imperial.quantity),
    imperialUnit: imperial.unit,
  };
}
