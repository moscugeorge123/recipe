import { normalizeIngredientName, normalizeUnit } from '../../normalization/domain/units.js';
import type { ConversionResult, FoodPortion } from './types.js';

/** Mass units → grams. */
export const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.349523125,
  lb: 453.59237,
};

/** Volume units → millilitres. No density is applied here. */
export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  cup: 236.5882365,
  'fl oz': 29.5735295625,
  floz: 29.5735295625,
};

/**
 * Published approximate densities (g/ml) for common ingredients.
 * Ingredients not listed are never given a guessed density.
 */
export const KNOWN_DENSITIES_G_PER_ML: Record<string, number> = {
  water: 1,
  milk: 1.03,
  'whole milk': 1.03,
  'olive oil': 0.91,
  'vegetable oil': 0.92,
  oil: 0.91,
  butter: 0.911,
  honey: 1.42,
  'all-purpose flour': 0.53,
  flour: 0.53,
  sugar: 0.85,
  salt: 1.2,
  'black pepper': 0.5,
};

/**
 * Established typical weights for countable foods. Unknown counts stay unmatched.
 */
export const KNOWN_COUNT_GRAMS: Record<string, number> = {
  egg: 50,
  eggs: 50,
  'garlic clove': 3,
  garlic: 3,
};

const PINCH_UNITS = new Set(['pinch', 'dash', 'to taste', 'taste']);

export function parseQuantityNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes('/')) {
    const [num, den] = trimmed.split('/');
    const n = Number(num);
    const d = Number(den);
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0 && n / d > 0) {
      return n / d;
    }
  }
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function densityForIngredient(name: string): number | undefined {
  const canonical = normalizeIngredientName(name);
  return KNOWN_DENSITIES_G_PER_ML[canonical] ?? KNOWN_DENSITIES_G_PER_ML[name.toLowerCase().trim()];
}

export function countGramsForIngredient(name: string, unit: string | null): number | undefined {
  const canonical = normalizeIngredientName(name);
  if ((unit === 'clove' || unit === 'cloves') && canonical.includes('garlic')) {
    return KNOWN_COUNT_GRAMS['garlic clove'];
  }
  return KNOWN_COUNT_GRAMS[canonical] ?? KNOWN_COUNT_GRAMS[name.toLowerCase().trim()];
}

function normalizePortionText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function portionMatchesUnit(portion: FoodPortion, unit: string): boolean {
  const haystack = normalizePortionText(portion.description);
  const needle = normalizePortionText(unit);
  if (!needle) {
    return false;
  }
  return haystack === needle || haystack.includes(needle);
}

/**
 * Converts a recipe quantity into grams using mass, known density, typical counts,
 * or USDA portions. Returns a failure instead of inventing a weight.
 */
export function convertToGrams(input: {
  quantity: number | null;
  unit: string | null;
  ingredientName: string;
  portions?: FoodPortion[];
}): ConversionResult {
  if (input.quantity === null || input.quantity <= 0) {
    return { ok: false, reason: 'missing-quantity' };
  }

  const unit = normalizeUnit(input.unit);
  if (unit && PINCH_UNITS.has(unit)) {
    return { ok: false, reason: 'unknown-unit' };
  }

  if (unit && unit in MASS_TO_GRAMS) {
    const factor = MASS_TO_GRAMS[unit];
    if (factor === undefined) {
      return { ok: false, reason: 'unknown-unit' };
    }
    return { ok: true, grams: input.quantity * factor, source: 'mass' };
  }

  if (unit && unit in VOLUME_TO_ML) {
    const mlFactor = VOLUME_TO_ML[unit];
    if (mlFactor === undefined) {
      return { ok: false, reason: 'unknown-unit' };
    }
    const ml = input.quantity * mlFactor;
    const density = densityForIngredient(input.ingredientName);
    if (density !== undefined) {
      return { ok: true, grams: ml * density, source: 'volume-density' };
    }
    const portions = input.portions ?? [];
    const portion = portions.find((entry) => portionMatchesUnit(entry, unit) && entry.amount > 0);
    if (portion) {
      return {
        ok: true,
        grams: (input.quantity / portion.amount) * portion.gramWeight,
        source: 'portion',
      };
    }
    return { ok: false, reason: 'no-density' };
  }

  const countGrams = countGramsForIngredient(input.ingredientName, unit);
  if (countGrams !== undefined && (unit === null || unit === 'clove' || unit === 'piece')) {
    return { ok: true, grams: input.quantity * countGrams, source: 'count' };
  }

  const portions = input.portions ?? [];
  if (unit) {
    const portion = portions.find((entry) => portionMatchesUnit(entry, unit) && entry.amount > 0);
    if (portion) {
      return {
        ok: true,
        grams: (input.quantity / portion.amount) * portion.gramWeight,
        source: 'portion',
      };
    }
    return { ok: false, reason: 'no-portion' };
  }

  const eachPortion = portions.find(
    (entry) =>
      entry.amount > 0 &&
      /\b(item|each|large|medium|small|unit|egg|clove)\b/.test(normalizePortionText(entry.description)),
  );
  if (eachPortion) {
    return {
      ok: true,
      grams: (input.quantity / eachPortion.amount) * eachPortion.gramWeight,
      source: 'portion',
    };
  }

  if (countGrams !== undefined) {
    return { ok: true, grams: input.quantity * countGrams, source: 'count' };
  }

  return { ok: false, reason: unit ? 'unknown-unit' : 'no-portion' };
}