import type {
  Prisma,
  NutritionStatus,
  Recipe,
  RecipeIngredient,
  RecipeReviewState,
  RecipeSource,
  RecipeStep,
  RevisionSource,
  SourceType,
} from '@prisma/client';

export interface CreateRecipeIngredientInput {
  name: string;
  canonicalName?: string | null;
  quantity?: Prisma.Decimal | null;
  unit?: string | null;
  preparation?: string | null;
  optional?: boolean;
  emoji?: string;
  colorToken?: string;
  category?: string;
  confidence?: number;
  provenance?: Prisma.InputJsonValue;
  warnings?: Prisma.InputJsonValue;
  sortOrder: number;
}

export interface CreateRecipeStepInput {
  stepOrder: number;
  instruction: string;
  durationMinutes?: number | null;
  temperature?: string | null;
  stage?: string;
  confidence?: number;
  provenance?: Prisma.InputJsonValue;
  warnings?: Prisma.InputJsonValue;
}

export interface CreateRecipeInput {
  recipeSourceId: string;
  title: string;
  description?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  calories?: number | null;
  cuisine?: string | null;
  nutrition?: Prisma.InputJsonValue | null;
  sourceLanguage?: string | null;
  confidence?: number;
  warnings?: Prisma.InputJsonValue;
  promptVersion?: string | null;
  rawExtraction?: Prisma.InputJsonValue;
  categorySlugs?: string[];
  reviewState?: RecipeReviewState;
  ingredients: CreateRecipeIngredientInput[];
  steps: CreateRecipeStepInput[];
}

export type RecipeWithDetails = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type RecipeListSort = 'latest' | 'engagement';

export type RecipeListRecord = {
  id: string;
  userRecipeId: string;
  title: string;
  description: string | null;
  confidence: number;
  sourceLanguage: string | null;
  createdAt: Date;
  updatedAt: Date;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  calories: number | null;
  cuisine: string | null;
  isFavorite: boolean;
  rating: number | null;
  ratingAverage: number | null;
  ratingCount: number;
  cookCount: number;
  reviewState: RecipeReviewState;
  categories: CategorySnapshot[];
  ingredientCount: number;
  stepCount: number;
  recipeSource: RecipeSource;
};

export type RecipeEngagementRecord = {
  id: string;
  userRecipeId: string;
  isFavorite: boolean;
  rating: number | null;
  ratingAverage: number | null;
  ratingCount: number;
  cookCount: number;
  reviewState: RecipeReviewState;
  updatedAt: Date;
};

export type RecipeNoteRecord = {
  id: string;
  recipeId: string;
  body: string;
  cookSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CategorySnapshot {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface EffectiveRecipeRecord {
  id: string;
  userRecipeId: string;
  revisionId: string;
  revisionNumber: number;
  revisionSource: RevisionSource;
  reviewState: RecipeReviewState;
  rating: number | null;
  isFavorite: boolean;
  cookCount: number;
  nutritionStatus: NutritionStatus;
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  calories: number | null;
  cuisine: string | null;
  nutrition: Prisma.JsonValue | null;
  sourceLanguage: string | null;
  confidence: number;
  warnings: Prisma.JsonValue;
  promptVersion: string | null;
  ingredients: Array<{
    id: string;
    name: string;
    canonicalName: string | null;
    quantity: Prisma.Decimal | null;
    unit: string | null;
    preparation: string | null;
    optional: boolean;
    emoji: string;
    colorToken: string;
    category: string;
    confidence: number;
    provenance: Prisma.JsonValue;
    warnings: Prisma.JsonValue;
    sortOrder: number;
  }>;
  steps: Array<{
    id: string;
    stepOrder: number;
    instruction: string;
    durationMinutes: number | null;
    temperature: string | null;
    stage: string;
    confidence: number;
    provenance: Prisma.JsonValue;
    warnings: Prisma.JsonValue;
  }>;
  categories: CategorySnapshot[];
  source: RecipeSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeRevisionSummary {
  id: string;
  revisionNumber: number;
  source: RevisionSource;
  createdAt: Date;
  title: string;
  isOriginal: boolean;
  summary: string;
  changes: string[];
}

export interface RevisionSnapshotInput {
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  calories: number | null;
  cuisine: string | null;
  categoryIds: string[];
  ingredients: Array<{
    name: string;
    canonicalName: string | null;
    quantity: Prisma.Decimal | null;
    unit: string | null;
    preparation: string | null;
    optional: boolean;
    emoji: string;
    colorToken: string;
    category: string;
    sortOrder: number;
  }>;
  steps: Array<{
    stepOrder: number;
    instruction: string;
    durationMinutes: number | null;
    temperature: string | null;
    stage: string;
  }>;
}

export interface IRecipeRepository {
  create(input: CreateRecipeInput): Promise<RecipeWithDetails>;
  findById(id: string): Promise<RecipeWithDetails | null>;
  findBySourceId(recipeSourceId: string): Promise<RecipeWithDetails | null>;
  delete(id: string): Promise<void>;
  list(params: {
    page: number;
    pageSize: number;
    userId?: string;
    q?: string;
    cuisine?: string;
    sourceType?: SourceType;
    sort?: RecipeListSort;
  }): Promise<{ items: RecipeListRecord[]; total: number }>;
  update(
    id: string,
    input: Partial<Omit<CreateRecipeInput, 'recipeSourceId'>>,
  ): Promise<RecipeWithDetails>;
  findEffectiveById(id: string, userId: string): Promise<EffectiveRecipeRecord | null>;
  setFavorite(
    id: string,
    userId: string,
    isFavorite: boolean,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null>;
  setRating(
    id: string,
    userId: string,
    rating: number | null,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null>;
  setReviewState(
    id: string,
    userId: string,
    reviewState: RecipeReviewState,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null>;
  adjustCompletedCookCount(userId: string, recipeId: string, delta: number): Promise<void>;
  listNotes(id: string, userId: string): Promise<RecipeNoteRecord[] | null>;
  createNote(
    id: string,
    userId: string,
    input: { body: string; cookSessionId?: string | null },
  ): Promise<RecipeNoteRecord | 'invalid-session' | null>;
  updateNote(
    id: string,
    noteId: string,
    userId: string,
    input: { body?: string; cookSessionId?: string | null },
  ): Promise<RecipeNoteRecord | 'invalid-session' | null>;
  deleteNote(id: string, noteId: string, userId: string): Promise<boolean>;
  appendRevision(
    id: string,
    userId: string,
    expectedRevisionNumber: number,
    input: RevisionSnapshotInput,
  ): Promise<EffectiveRecipeRecord | 'conflict' | 'invalid-categories' | null>;
  listRevisions(id: string, userId: string): Promise<RecipeRevisionSummary[] | null>;
  findRevision(
    id: string,
    revisionId: string,
    userId: string,
  ): Promise<EffectiveRecipeRecord | null>;
  restoreRevision(
    id: string,
    revisionId: string,
    userId: string,
    expectedRevisionNumber: number,
  ): Promise<EffectiveRecipeRecord | 'conflict' | null>;
}
