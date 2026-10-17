import { Prisma } from '@prisma/client';

import type { ExtractedIngredient } from '../../recipes/domain/types.js';
import { isEnglishOutputLanguage } from '../../recipes/prompts/recipe-extraction-v1.js';
import { toSentenceCase } from '../domain/casing.js';
import { reconcileMeasurements, type Measurement } from '../domain/measurement-conversion.js';
import { resolveIngredientPresentation } from '../domain/presentation.js';
import {
  normalizeIngredientName,
  normalizeUnit,
  parseQuantity,
  splitQuantityPhrase,
} from '../domain/units.js';

/** Count units that only make sense next to a number; without an amount they are dropped. */
const COUNT_ONLY_UNITS = new Set(['piece', 'pieces', 'slice', 'slices', 'buc', 'bucata', 'bucati']);

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
    quantityMax: Prisma.Decimal | null;
    unit: string | null;
    group: string | null;
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
    const english = isEnglishOutputLanguage(outputLanguage);
    // The model sometimes writes the whole phrase in `quantity` ("2 to 4 tablespoons").
    const phrase = splitQuantityPhrase(ingredient.quantity);
    const explicitUnit = english ? normalizeUnit(ingredient.unit) : ingredient.unit?.trim() || null;
    let unit = explicitUnit ?? (english ? phrase.unit : (phrase.unitText ?? phrase.unit));
    const qty = phrase.min ?? parseQuantity(ingredient.quantity);
    const qtyMax = qty !== null && phrase.max !== null && phrase.max > qty ? phrase.max : null;

    if (ingredient.quantity && qty === null && !phrase.unit) {
      warnings.push(`Could not parse quantity "${ingredient.quantity}"`);
    }

    if (!ingredient.quantity && !ingredient.optional) {
      warnings.push('Missing quantity');
    }

    // "Lemon wedges, to serve" has no amount: a bare "piece" label would read as an amount.
    if (qty === null && unit !== null && COUNT_ONLY_UNITS.has(unit.toLowerCase())) {
      unit = null;
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
      quantityMax: toDecimal(qtyMax),
      unit,
      group: ingredient.group?.trim() || null,
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
