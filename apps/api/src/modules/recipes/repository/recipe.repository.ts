import type { Prisma, Recipe, RecipeIngredient, RecipeSource, RecipeStep, SourceType } from '@prisma/client';

export interface CreateRecipeIngredientInput {
  name: string;
  canonicalName?: string | null;
  quantity?: Prisma.Decimal | null;
  unit?: string | null;
  preparation?: string | null;
  optional?: boolean;
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
  ingredients: CreateRecipeIngredientInput[];
  steps: CreateRecipeStepInput[];
}

export type RecipeWithDetails = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type RecipeListRecord = Recipe & {
  recipeSource: RecipeSource;
  _count: { ingredients: number; steps: number };
};

export interface IRecipeRepository {
  create(input: CreateRecipeInput): Promise<RecipeWithDetails>;
  findById(id: string): Promise<RecipeWithDetails | null>;
  findBySourceId(recipeSourceId: string): Promise<RecipeWithDetails | null>;
  delete(id: string): Promise<void>;
  list(params: {
    page: number;
    pageSize: number;
    q?: string;
    cuisine?: string;
    sourceType?: SourceType;
  }): Promise<{ items: RecipeListRecord[]; total: number }>;
  update(id: string, input: Partial<Omit<CreateRecipeInput, 'recipeSourceId'>>): Promise<RecipeWithDetails>;
}
