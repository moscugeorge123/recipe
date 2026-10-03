export const RecipeReviewState = {
  NEEDS_REVIEW: "NEEDS_REVIEW",
  READY: "READY",
} as const;

export type RecipeReviewState =
  (typeof RecipeReviewState)[keyof typeof RecipeReviewState];

export type RecipeRating = 1 | 2 | 3 | 4 | 5;

export const RecipeListSort = {
  LATEST: "latest",
  ENGAGEMENT: "engagement",
} as const;

export type RecipeListSort =
  (typeof RecipeListSort)[keyof typeof RecipeListSort];

export interface UserRecipeState {
  userRecipeId: string;
  reviewState: RecipeReviewState;
  rating?: RecipeRating;
  isFavorite: boolean;
}

/** Profile-owned heart/stars plus completed-cook rank fields. */
export interface RecipeEngagement {
  id: string;
  userRecipeId: string;
  isFavorite: boolean;
  /** The calling profile's own 1–5 rating, never an aggregate. */
  rating: RecipeRating | null;
  /** Aggregate average across profiles. Singleton profiles equal `rating`. */
  ratingAverage: number | null;
  ratingCount: number;
  /** Count of COMPLETED cook sessions only. STOPPED sessions are excluded. */
  cookCount: number;
  updatedAt: string;
}

export interface RecipeNote {
  id: string;
  recipeId: string;
  body: string;
  cookSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}
