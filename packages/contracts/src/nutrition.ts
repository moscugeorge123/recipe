export const NutritionStatus = {
  NOT_REQUESTED: "NOT_REQUESTED",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;

export type NutritionStatus =
  (typeof NutritionStatus)[keyof typeof NutritionStatus];

/** Product-facing nutrition states shown in recipe detail. */
export const NutritionUxStatus = {
  READY: "READY",
  PARTIAL: "PARTIAL",
  UNAVAILABLE: "UNAVAILABLE",
  PENDING: "PENDING",
  FAILED: "FAILED",
} as const;

export type NutritionUxStatus =
  (typeof NutritionUxStatus)[keyof typeof NutritionUxStatus];

export interface NutritionValues {
  calories?: number;
  proteinGrams?: number;
  carbohydrateGrams?: number;
  fatGrams?: number;
  saturatedFatGrams?: number;
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMilligrams?: number;
}

export interface NutritionFoodMatch {
  ingredientId?: string;
  query: string;
  matchedFoodId?: string;
  matchedFoodName?: string;
  confidence?: number;
  grams?: number;
  nutrients?: NutritionValues;
}

export interface NutritionSnapshot {
  id: string;
  recipeRevisionId: string;
  status: NutritionStatus;
  perServing?: NutritionValues;
  per100g?: NutritionValues;
  wholeRecipe?: NutritionValues;
  servings?: number;
  coveragePercent?: number;
  unmatchedIngredients?: string[];
  provider?: string;
  calculatedAt?: string;
  matches: NutritionFoodMatch[];
  failureReason?: string;
}

/**
 * Maps persisted calculation state onto the product UX.
 *
 * - COMPLETED → READY (full coverage)
 * - PARTIAL → PARTIAL
 * - FAILED → FAILED
 * - PENDING / PROCESSING → PENDING
 * - NOT_REQUESTED / missing → UNAVAILABLE, or PENDING when a calculation was requested
 */
export function toNutritionUxStatus(
  status: NutritionStatus | null | undefined,
  requested = false,
): NutritionUxStatus {
  switch (status) {
    case NutritionStatus.COMPLETED:
      return NutritionUxStatus.READY;
    case NutritionStatus.PARTIAL:
      return NutritionUxStatus.PARTIAL;
    case NutritionStatus.FAILED:
      return NutritionUxStatus.FAILED;
    case NutritionStatus.PENDING:
    case NutritionStatus.PROCESSING:
      return NutritionUxStatus.PENDING;
    case NutritionStatus.NOT_REQUESTED:
      return requested ? NutritionUxStatus.PENDING : NutritionUxStatus.UNAVAILABLE;
    default:
      return requested ? NutritionUxStatus.PENDING : NutritionUxStatus.UNAVAILABLE;
  }
}
