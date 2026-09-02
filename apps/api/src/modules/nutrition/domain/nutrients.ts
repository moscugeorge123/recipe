import type { NutritionValues } from '@recipe/contracts';

export const NUTRIENT_KEYS = [
  'calories',
  'proteinGrams',
  'carbohydrateGrams',
  'fatGrams',
  'saturatedFatGrams',
  'fiberGrams',
  'sugarGrams',
  'sodiumMilligrams',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** FDC nutrient numbers / ids for the macros we persist. */
export const FDC_NUTRIENT_IDS: Record<NutrientKey, number[]> = {
  calories: [1008, 2047, 2048, 208],
  proteinGrams: [1003, 203],
  carbohydrateGrams: [1005, 205],
  fatGrams: [1004, 204],
  saturatedFatGrams: [1258, 606],
  fiberGrams: [1079, 291],
  sugarGrams: [2000, 269, 1063],
  sodiumMilligrams: [1093, 307],
};

export function emptyNutritionValues(): NutritionValues {
  return {};
}

export function roundNutrient(key: NutrientKey, value: number): number {
  if (key === 'calories' || key === 'sodiumMilligrams') {
    return Math.round(value);
  }
  return Math.round(value * 10) / 10;
}

export function scaleNutrition(values: NutritionValues, factor: number): NutritionValues {
  const scaled: NutritionValues = {};
  for (const key of NUTRIENT_KEYS) {
    const current = values[key];
    if (typeof current === 'number' && Number.isFinite(current)) {
      scaled[key] = roundNutrient(key, current * factor);
    }
  }
  return scaled;
}

export function addNutrition(left: NutritionValues, right: NutritionValues): NutritionValues {
  const sum: NutritionValues = { ...left };
  for (const key of NUTRIENT_KEYS) {
    const extra = right[key];
    if (typeof extra !== 'number' || !Number.isFinite(extra)) {
      continue;
    }
    const current = sum[key];
    sum[key] = roundNutrient(key, (typeof current === 'number' ? current : 0) + extra);
  }
  return sum;
}

export function divideNutrition(values: NutritionValues, divisor: number): NutritionValues | null {
  if (!(divisor > 0)) {
    return null;
  }
  return scaleNutrition(values, 1 / divisor);
}

export function nutritionHasAnyValue(values: NutritionValues | null | undefined): boolean {
  if (!values) {
    return false;
  }
  return NUTRIENT_KEYS.some((key) => typeof values[key] === 'number');
}