import type { CookSession, CookSessionStatus, CookSessionStepStat } from '@prisma/client';

export type CookSessionRecipeSummary = {
  id: string;
  title: string;
  _count: { steps: number };
};

export type CookSessionWithRecipe = CookSession & {
  recipe: CookSessionRecipeSummary;
  stepStats: CookSessionStepStat[];
};

export interface CreateCookSessionInput {
  recipeId: string;
  currentStepIndex?: number;
}

export interface StepStatUpsert {
  stepIndex: number;
  visitCount: number;
  durationMs: number;
  firstEnteredAt: Date;
  lastEnteredAt: Date;
}

export interface UpdateCookSessionInput {
  currentStepIndex?: number;
  status?: CookSessionStatus;
  finishedAt?: Date | null;
  currentStepEnteredAt?: Date;
  stepStats?: StepStatUpsert[];
}

export interface ICookSessionRepository {
  create(input: CreateCookSessionInput): Promise<CookSessionWithRecipe>;
  findById(id: string): Promise<CookSessionWithRecipe | null>;
  findInProgressByRecipeId(recipeId: string): Promise<CookSessionWithRecipe | null>;
  findManyInProgress(exceptRecipeId?: string): Promise<CookSessionWithRecipe[]>;
  list(params: {
    page: number;
    pageSize: number;
    status?: CookSessionStatus;
  }): Promise<{ items: CookSessionWithRecipe[]; total: number }>;
  update(id: string, input: UpdateCookSessionInput): Promise<CookSessionWithRecipe>;
  delete(id: string): Promise<void>;
}
