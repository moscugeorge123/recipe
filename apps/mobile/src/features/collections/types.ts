import type { RecipeListItemView } from '@/features/recipes/types';

export type CollectionCoverPreview = {
  recipeId: string;
  title: string;
  thumbnailUrl: string | null;
};

export type CollectionSummary = {
  id: string;
  name: string;
  description: string | null;
  recipeCount: number;
  recipeIds: string[];
  coverPreviews: CollectionCoverPreview[];
  createdAt: string;
  updatedAt: string;
  fromCache?: boolean;
};

export type CollectionRecipe = RecipeListItemView & {
  sortOrder: number;
};

export type CollectionDetail = CollectionSummary & {
  recipes: CollectionRecipe[];
};
