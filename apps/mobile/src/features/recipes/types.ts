import type { MeasurementSystem, NutritionSource } from '@recipe/contracts';

export type { MeasurementSystem, NutritionSource };

export type RecipeId = string;
export type RecipeOrigin = 'seed' | 'api';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type StepStage = 'PREP' | 'COOK' | 'FINISH' | 'SERVE';
export type IngredientCategory =
  'Produce' | 'Meat' | 'Dairy' | 'Pantry' | 'Spices' | 'Frozen';

/** The same ingredient amount in one measurement system. */
export type MeasurementView = {
  quantity: number | null;
  unit: string | null;
};

export type RecipeIngredientView = {
  id: string;
  name: string;
  canonicalName?: string | null;
  emoji?: string;
  colorToken?: string;
  /** Amount as written in the source. */
  quantity: number | null;
  unit: string | null;
  metric?: MeasurementView | null;
  imperial?: MeasurementView | null;
  preparation: string | null;
  optional: boolean;
  category: IngredientCategory;
  confidence: number;
};

export type RecipeStepView = {
  id: string;
  stepOrder: number;
  /** Short label from extraction. Null on recipes saved before titles existed. */
  title: string | null;
  instruction: string;
  durationSeconds: number | null;
  temperature: string | null;
  temperatureCelsius?: number | null;
  temperatureFahrenheit?: number | null;
  /** Extracted 0-based indexes into `ingredients` used by this step. */
  ingredientRefs?: number[];
  stage: StepStage;
  /** Work that happens before the cooking session. */
  ahead: boolean;
  ingredientHint: string | null;
  confidence: number;
};

/** Grams per serving from the extractor. */
export type RecipeMacros = {
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
};

export type RecipeView = {
  id: RecipeId;
  origin: RecipeOrigin;
  title: string;
  description: string | null;
  sourceType: string;
  sourceLabel: string;
  creator: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  placeholder: [string, string];
  minutes: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  difficulty: Difficulty;
  servings: number;
  cuisine: string;
  /** kcal per serving from the extractor (stated by the source or estimated). */
  calories: number | null;
  nutritionSource?: NutritionSource | null;
  macros?: RecipeMacros | null;
  confidence: number;
  warnings: unknown;
  ingredients: RecipeIngredientView[];
  steps: RecipeStepView[];
  ingredientCount?: number;
  stepCount?: number;
  createdAt?: string;
  revisionId?: string;
  revisionNumber?: number;
  reviewState?: 'NEEDS_REVIEW' | 'READY';
  categories?: RecipeCategoryView[];
  isFavorite?: boolean;
  rating?: number | null;
  ratingAverage?: number | null;
  ratingCount?: number;
  cookCount?: number;
  fromCache?: boolean;
};

export type RecipeCategoryView = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export type RecipeListItemView = {
  id: RecipeId;
  title: string;
  description: string | null;
  confidence: number;
  sourceLanguage: string | null;
  createdAt: string;
  updatedAt: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  calories: number | null;
  cuisine: string | null;
  difficulty: Difficulty | null;
  minutes: number | null;
  sourceType: string;
  sourceLabel: string;
  creator: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  ingredientCount: number;
  stepCount: number;
  userRecipeId?: string;
  categories?: RecipeCategoryView[];
  isFavorite?: boolean;
  rating?: number | null;
  ratingAverage?: number | null;
  ratingCount?: number;
  cookCount?: number;
  reviewState?: 'NEEDS_REVIEW' | 'READY';
};
