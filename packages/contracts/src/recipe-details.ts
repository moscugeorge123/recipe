export const MeasurementSystem = {
  METRIC: "metric",
  IMPERIAL: "imperial",
} as const;

export type MeasurementSystem =
  (typeof MeasurementSystem)[keyof typeof MeasurementSystem];

/** Whether calories/macros were printed by the source or estimated by the extractor. */
export const NutritionSource = {
  STATED: "stated",
  ESTIMATED: "estimated",
} as const;

export type NutritionSource =
  (typeof NutritionSource)[keyof typeof NutritionSource];

export const RECIPE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type RecipeDifficulty = (typeof RECIPE_DIFFICULTIES)[number];

/** Unit symbols the API uses in `metric` / `imperial` ingredient amounts (besides count units). */
export const METRIC_UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cm", "mm"] as const;
export const IMPERIAL_UNITS = ["oz", "lb", "tsp", "tbsp", "cup", "fl oz", "in"] as const;

/**
 * One ingredient amount in a single measurement system. Count units ("2 cloves", "a pinch")
 * repeat the original amount in both systems. `quantity` is a decimal string.
 */
export interface IngredientMeasurement {
  quantity: string | null;
  unit: string | null;
}

/** Grams per serving, produced by the extractor. */
export interface RecipeNutrition {
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
}
