import {
  DEFAULT_CATEGORIES,
  ErrorCode,
  HttpStatus,
  NutritionStatus,
  toNutritionUxStatus,
  isRetryableFailure,
  PantryClassificationStatus,
  parsePantryText,
  pantryHasIngredient,
  RecipeReviewState,
  ShoppingListSource,
  MealSlot,
  MealEntryKind,
  MEAL_PLAN_NOTE_MAX_LENGTH,
  mondayOfWeek,
  sundayOfWeek,
  RecipeListSort,
  RevisionSource,
  type AsyncUxState,
} from '@recipe/contracts';
import { describe, expect, it } from 'vitest';

describe('shared platform contracts', () => {
  it('keeps category slugs and API error/status values stable', () => {
    expect(DEFAULT_CATEGORIES.map(({ slug }) => slug)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'sweet',
    ]);
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    expect(HttpStatus.CONFLICT).toBe(409);
    expect(HttpStatus.SERVICE_UNAVAILABLE).toBe(503);
    expect(NutritionStatus.PARTIAL).toBe('PARTIAL');
    expect(toNutritionUxStatus(NutritionStatus.COMPLETED)).toBe('READY');
    expect(toNutritionUxStatus(NutritionStatus.NOT_REQUESTED)).toBe('UNAVAILABLE');
    expect(toNutritionUxStatus(NutritionStatus.NOT_REQUESTED, true)).toBe('PENDING');
    expect(PantryClassificationStatus.NEEDS_REVIEW).toBe('NEEDS_REVIEW');
    expect(parsePantryText('salt, pepper\n1,000 g flour')).toEqual([
      'salt',
      'pepper',
      '1,000 g flour',
    ]);
    expect(
      pantryHasIngredient({ name: 'Unsalted butter', canonicalName: 'unsalted butter' }, ['salt']),
    ).toBe(false);
    expect(
      pantryHasIngredient({ name: 'Olive oil', canonicalName: 'olive oil' }, ['olive oil']),
    ).toBe(true);
    expect(ShoppingListSource.MANUAL).toBe('MANUAL');
    expect(ShoppingListSource.RECIPE).toBe('RECIPE');
    expect(ShoppingListSource.MEAL_PLAN).toBe('MEAL_PLAN');
    expect(MealSlot.BREAKFAST).toBe('BREAKFAST');
    expect(MealSlot.SNACK).toBe('SNACK');
    expect(MealEntryKind.RECIPE).toBe('RECIPE');
    expect(MealEntryKind.NOTE).toBe('NOTE');
    expect(MEAL_PLAN_NOTE_MAX_LENGTH).toBe(75);
    expect(mondayOfWeek('2026-09-12')).toBe('2026-09-07');
    expect(sundayOfWeek('2026-09-12')).toBe('2026-09-13');
    expect(RecipeReviewState.READY).toBe('READY');
    expect(ErrorCode.RECIPE_ENGAGEMENT_CONFLICT).toBe('RECIPE_ENGAGEMENT_CONFLICT');
    expect(ErrorCode.RECIPE_NOTE_NOT_FOUND).toBe('RECIPE_NOTE_NOT_FOUND');
    expect(ErrorCode.COLLECTION_NOT_FOUND).toBe('COLLECTION_NOT_FOUND');
    expect(ErrorCode.COLLECTION_NAME_CONFLICT).toBe('COLLECTION_NAME_CONFLICT');
    expect(RecipeListSort.LATEST).toBe('latest');
    expect(RecipeListSort.ENGAGEMENT).toBe('engagement');
    expect(RevisionSource.RESTORE).toBe('RESTORE');
    expect(isRetryableFailure(429, ErrorCode.TOO_MANY_REQUESTS)).toBe(true);
    expect(isRetryableFailure(404, ErrorCode.NOT_FOUND)).toBe(false);
    expect(isRetryableFailure(500, ErrorCode.INTERNAL_SERVER_ERROR)).toBe(true);
  });

  it('defines explicit loading, empty, error/retry, and ready UX states', () => {
    const states = [
      { status: 'loading' },
      { status: 'empty', title: 'No recipes yet', actionLabel: 'Add recipe' },
      { status: 'error', message: 'Could not load recipes', retryable: true },
      { status: 'ready', data: ['recipe'], refreshing: true },
    ] satisfies AsyncUxState<string[]>[];

    expect(states.map(({ status }) => status)).toEqual(['loading', 'empty', 'error', 'ready']);
  });
});
