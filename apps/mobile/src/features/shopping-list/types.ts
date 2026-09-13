export type ShoppingListSource = 'MANUAL' | 'RECIPE' | 'MEAL_PLAN';

export type ShoppingListItemView = {
  id: string;
  name: string;
  canonicalName: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  done: boolean;
  fromRecipeCount: number;
  source: ShoppingListSource;
  sourceRecipeId: string | null;
  sourceMealPlanEntryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListWriteItem = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string;
  emoji?: string;
  sourceRecipeId?: string;
};

export type ShoppingListListPage = {
  items: ShoppingListItemView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  fromCache?: boolean;
};
