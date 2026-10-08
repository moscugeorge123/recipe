import type { Prisma } from '@prisma/client';

import { measurementColumns } from '../../normalization/application/ingredient-normalizer.js';
import {
  reconcileMeasurements,
  reconcileTemperature,
  type IngredientMeasurements,
} from '../../normalization/domain/measurement-conversion.js';
import type { EffectiveRecipeRecord } from '../repository/recipe.repository.js';

type ExistingIngredient = EffectiveRecipeRecord['ingredients'][number];
type ExistingStep = EffectiveRecipeRecord['steps'][number];

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function sameDecimal(left: Prisma.Decimal | null, right: Prisma.Decimal | null): boolean {
  if (left === null || right === null) return left === right;
  return left.equals(right);
}

function decimalNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

/** Stored measurements, or a deterministic fill for rows saved before they existed. */
export function storedMeasurements(ingredient: {
  quantity: Prisma.Decimal | null;
  unit: string | null;
  metricQuantity: Prisma.Decimal | null;
  metricUnit: string | null;
  imperialQuantity: Prisma.Decimal | null;
  imperialUnit: string | null;
}): IngredientMeasurements {
  const hasStored =
    ingredient.metricQuantity !== null ||
    ingredient.metricUnit !== null ||
    ingredient.imperialQuantity !== null ||
    ingredient.imperialUnit !== null;
  if (hasStored) {
    return {
      metric: { quantity: decimalNumber(ingredient.metricQuantity), unit: ingredient.metricUnit },
      imperial: {
        quantity: decimalNumber(ingredient.imperialQuantity),
        unit: ingredient.imperialUnit,
      },
    };
  }
  return reconcileMeasurements({
    quantity: decimalNumber(ingredient.quantity),
    unit: ingredient.unit,
  });
}

/**
 * Metric/imperial columns for an ingredient in a user edit. An unchanged row (same name, amount,
 * unit) keeps the imported values, which may include the model's volume→weight conversion; an
 * edited row gets the deterministic conversion.
 */
export function measurementsForEdit(
  next: { name: string; quantity: Prisma.Decimal | null; unit: string | null },
  existing: ExistingIngredient[],
): ReturnType<typeof measurementColumns> {
  const match = existing.find(
    (item) =>
      nameKey(item.name) === nameKey(next.name) &&
      (item.unit ?? null) === (next.unit ?? null) &&
      sameDecimal(item.quantity, next.quantity),
  );
  const measurements = match
    ? storedMeasurements(match)
    : reconcileMeasurements({ quantity: decimalNumber(next.quantity), unit: next.unit });
  return measurementColumns(measurements.metric, measurements.imperial);
}

/**
 * °C/°F and ingredient refs for a step in a user edit. Refs from an unchanged instruction are
 * remapped by ingredient name onto the new ingredient order; edited steps drop them.
 */
export function stepExtrasForEdit(
  next: { instruction: string; temperature: string | null },
  existingSteps: ExistingStep[],
  existingIngredients: ExistingIngredient[],
  nextIngredients: Array<{ name: string }>,
): { temperatureCelsius: number | null; temperatureFahrenheit: number | null; ingredientRefs: number[] } {
  const same = existingSteps.find((step) => step.instruction.trim() === next.instruction.trim());
  const keepTemperature =
    same !== undefined &&
    (same.temperature ?? null) === (next.temperature ?? null) &&
    (same.temperatureCelsius !== null || same.temperatureFahrenheit !== null);
  const temperature = keepTemperature
    ? { celsius: same.temperatureCelsius, fahrenheit: same.temperatureFahrenheit }
    : reconcileTemperature({ text: next.temperature, instruction: next.instruction });

  const nextIndex = new Map<string, number>();
  nextIngredients.forEach((ingredient, index) => {
    const key = nameKey(ingredient.name);
    if (!nextIndex.has(key)) nextIndex.set(key, index);
  });
  const refs = (same?.ingredientRefs ?? [])
    .map((ref) => {
      const previous = existingIngredients[ref];
      return previous ? nextIndex.get(nameKey(previous.name)) : undefined;
    })
    .filter((ref): ref is number => ref !== undefined);

  return {
    temperatureCelsius: temperature?.celsius ?? null,
    temperatureFahrenheit: temperature?.fahrenheit ?? null,
    ingredientRefs: [...new Set(refs)].sort((a, b) => a - b),
  };
}
