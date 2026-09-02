import type { NutritionValues } from '@recipe/contracts';

export interface FoodPortion {
  gramWeight: number;
  amount: number;
  description: string;
}

export interface MatchedFood {
  fdcId: string;
  name: string;
  dataType: string;
  nutrientsPer100g: NutritionValues;
  portions: FoodPortion[];
  confidence: number;
}

export interface NutritionSearchQuery {
  query: string;
}

/** Replaceable nutrition data source (USDA today, another catalog later). */
export interface NutritionProvider {
  readonly id: string;
  search(query: NutritionSearchQuery): Promise<MatchedFood | null>;
  getFood(fdcId: string): Promise<MatchedFood | null>;
}

export class NutritionRateLimitError extends Error {
  constructor(message = 'Nutrition provider rate limited') {
    super(message);
    this.name = 'NutritionRateLimitError';
  }
}

export interface IngredientToMatch {
  id: string;
  name: string;
  canonicalName: string | null;
  quantity: number | null;
  unit: string | null;
}

export type ConversionFailureReason =
  | 'missing-quantity'
  | 'unknown-unit'
  | 'no-density'
  | 'no-portion';

export type ConversionResult =
  | { ok: true; grams: number; source: 'mass' | 'volume-density' | 'count' | 'portion' }
  | { ok: false; reason: ConversionFailureReason };

export interface CalculatedMatch {
  ingredientId: string;
  query: string;
  matchedFoodId: string | null;
  matchedFoodName: string | null;
  confidence: number | null;
  grams: number | null;
  nutrients: NutritionValues | null;
  unmatched: boolean;
}

export interface NutritionCalculation {
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  servings: number | null;
  wholeRecipe: NutritionValues | null;
  perServing: NutritionValues | null;
  per100g: NutritionValues | null;
  totalGrams: number | null;
  coveragePercent: number;
  matchedCount: number;
  totalCount: number;
  unmatchedIngredients: string[];
  matches: CalculatedMatch[];
  failureReason: string | null;
  provider: string;
  calculatedAt: Date;
}