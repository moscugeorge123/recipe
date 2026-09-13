export const ShoppingListSource = {
  MANUAL: "MANUAL",
  RECIPE: "RECIPE",
  MEAL_PLAN: "MEAL_PLAN",
} as const;

export type ShoppingListSource =
  (typeof ShoppingListSource)[keyof typeof ShoppingListSource];

export interface ShoppingListItemShape {
  id: string;
  name: string;
  canonicalName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  done: boolean;
  fromRecipeCount: number;
  source: ShoppingListSource;
  sourceRecipeId?: string | null;
  sourceMealPlanEntryId?: string | null;
  createdAt: string;
  updatedAt: string;
}
