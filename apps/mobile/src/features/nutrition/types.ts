export type NutritionUxStatus =
  'READY' | 'PARTIAL' | 'UNAVAILABLE' | 'PENDING' | 'FAILED';

export type NutritionValues = {
  calories?: number;
  proteinGrams?: number;
  carbohydrateGrams?: number;
  fatGrams?: number;
  saturatedFatGrams?: number;
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMilligrams?: number;
};

export type NutritionMatch = {
  id: string;
  revisionIngredientId: string | null;
  query: string;
  matchedFoodId: string | null;
  matchedFoodName: string | null;
  confidence: number | null;
  grams: number | null;
  nutrients: NutritionValues | null;
};

export type NutritionView = {
  recipeId: string;
  revisionId: string;
  snapshotId: string | null;
  status: NutritionUxStatus;
  calculationStatus: string | null;
  updating: boolean;
  provider: string | null;
  calculatedAt: string | null;
  servings: number | null;
  coverage: { matched: number; total: number; percent: number };
  unmatchedIngredients: string[];
  totals: NutritionValues | null;
  perPortion: NutritionValues | null;
  per100g: NutritionValues | null;
  matches: NutritionMatch[];
  failureReason: string | null;
  fromCache?: boolean;
};
