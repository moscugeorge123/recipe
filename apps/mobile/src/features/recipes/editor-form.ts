import type { FieldErrors, FieldPath } from 'react-hook-form';

import type { PatchRecipeBody } from '@/features/recipes/schemas';
import type { RecipeView } from '@/features/recipes/types';

export type IngredientDraft = {
  name: string;
  canonicalName: string;
  emoji: string;
  colorToken: string;
  quantity: string;
  unit: string;
  preparation: string;
  optional: boolean;
  category: string;
  confidence: number;
};

export type StepDraft = {
  title: string;
  instruction: string;
  durationMinutes: string;
  temperature: string;
  stage: string;
  ahead: boolean;
  confidence: number;
};

export type RecipeEditorValues = {
  title: string;
  description: string;
  cuisine: string;
  servings: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  totalTimeMinutes: string;
  calories: string;
  categoryIds: string[];
  ingredients: IngredientDraft[];
  steps: StepDraft[];
};

export const EMPTY_INGREDIENT: IngredientDraft = {
  name: '',
  canonicalName: '',
  emoji: '🥣',
  colorToken: 'peach',
  quantity: '',
  unit: '',
  preparation: '',
  optional: false,
  category: 'Pantry',
  confidence: 1,
};

export const EMPTY_STEP: StepDraft = {
  title: '',
  instruction: '',
  durationMinutes: '',
  temperature: '',
  stage: 'COOK',
  ahead: false,
  confidence: 1,
};

export function textNumber(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

export function nullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function warningMessages(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item];
    if (
      item &&
      typeof item === 'object' &&
      'message' in item &&
      typeof item.message === 'string' &&
      item.message.trim()
    ) {
      return [item.message];
    }
    return [];
  });
}

export function editorDefaults(recipe: RecipeView): RecipeEditorValues {
  return {
    title: recipe.title ?? '',
    description: recipe.description ?? '',
    cuisine: recipe.cuisine === 'Imported' ? '' : (recipe.cuisine ?? ''),
    servings: textNumber(recipe.servings),
    prepTimeMinutes: textNumber(recipe.prepTimeMinutes),
    cookTimeMinutes: textNumber(recipe.cookTimeMinutes),
    totalTimeMinutes: textNumber(recipe.totalTimeMinutes),
    calories: textNumber(recipe.calories),
    categoryIds: recipe.categories?.map((category) => category.id) ?? [],
    ingredients: (recipe.ingredients ?? []).map((ingredient) => ({
      name: ingredient.name ?? '',
      canonicalName:
        ingredient.canonicalName ?? ingredient.name?.toLowerCase() ?? '',
      emoji: ingredient.emoji ?? '🥣',
      colorToken: ingredient.colorToken ?? 'peach',
      quantity: textNumber(ingredient.quantity),
      unit: ingredient.unit ?? '',
      preparation: ingredient.preparation ?? '',
      optional: ingredient.optional ?? false,
      category: ingredient.category ?? 'Pantry',
      confidence: ingredient.confidence ?? 0,
    })),
    steps: (recipe.steps ?? []).map((step) => ({
      title: step.title ?? '',
      instruction: step.instruction ?? '',
      durationMinutes: textNumber(
        step.durationSeconds == null
          ? null
          : Math.round(step.durationSeconds / 60),
      ),
      temperature: step.temperature ?? '',
      stage: step.stage ?? 'COOK',
      ahead: step.ahead ?? false,
      confidence: step.confidence ?? 0,
    })),
  };
}

export function valuesEqual(
  left: RecipeEditorValues | undefined,
  right: RecipeEditorValues | undefined,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isRecipeEditorValues(
  value: unknown,
): value is RecipeEditorValues {
  if (!value || typeof value !== 'object') return false;
  const record = value as RecipeEditorValues;
  return (
    typeof record.title === 'string' &&
    Array.isArray(record.ingredients) &&
    Array.isArray(record.steps) &&
    Array.isArray(record.categoryIds)
  );
}

export function toPatchBody(
  values: RecipeEditorValues,
  expectedRevisionNumber: number,
): PatchRecipeBody {
  return {
    expectedRevisionNumber,
    title: values.title.trim(),
    description: values.description.trim() || null,
    cuisine: values.cuisine.trim() || null,
    servings: nullableNumber(values.servings),
    prepTimeMinutes: nullableNumber(values.prepTimeMinutes),
    cookTimeMinutes: nullableNumber(values.cookTimeMinutes),
    totalTimeMinutes: nullableNumber(values.totalTimeMinutes),
    calories: nullableNumber(values.calories),
    categoryIds: values.categoryIds,
    ingredients: values.ingredients.map((ingredient, index) => ({
      name: ingredient.name.trim(),
      canonicalName: ingredient.canonicalName.trim() || null,
      emoji: ingredient.emoji.trim() || '🥣',
      colorToken: ingredient.colorToken || 'peach',
      quantity: nullableNumber(ingredient.quantity),
      unit: ingredient.unit.trim() || null,
      preparation: ingredient.preparation.trim() || null,
      optional: ingredient.optional,
      category: ingredient.category || 'Pantry',
      sortOrder: index,
    })),
    steps: values.steps.map((step, index) => ({
      stepOrder: index + 1,
      title: step.title.trim() || null,
      instruction: step.instruction.trim(),
      durationMinutes: nullableNumber(step.durationMinutes),
      temperature: step.temperature.trim() || null,
      stage: step.stage || 'COOK',
      ahead: step.ahead,
    })),
  };
}

export function firstErrorPath(
  errors: FieldErrors<RecipeEditorValues>,
): FieldPath<RecipeEditorValues> | null {
  if (errors.title) return 'title';
  if (errors.servings) return 'servings';
  if (errors.prepTimeMinutes) return 'prepTimeMinutes';
  if (errors.cookTimeMinutes) return 'cookTimeMinutes';
  if (errors.totalTimeMinutes) return 'totalTimeMinutes';
  if (errors.calories) return 'calories';
  if (Array.isArray(errors.ingredients)) {
    for (let index = 0; index < errors.ingredients.length; index += 1) {
      const row = errors.ingredients[index];
      if (row?.name) return `ingredients.${index}.name`;
      if (row?.emoji) return `ingredients.${index}.emoji`;
    }
  }
  if (Array.isArray(errors.steps)) {
    for (let index = 0; index < errors.steps.length; index += 1) {
      const row = errors.steps[index];
      if (row?.instruction) return `steps.${index}.instruction`;
    }
  }
  return null;
}

export function summarizeEditor(values: RecipeEditorValues): {
  title: string;
  ingredientCount: number;
  stepCount: number;
} {
  return {
    title: values.title.trim() || 'Untitled recipe',
    ingredientCount: values.ingredients.length,
    stepCount: values.steps.length,
  };
}
