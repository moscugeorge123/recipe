export type CookSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'STOPPED';

export type CookSessionRecipe = {
  id: string;
  title: string;
  stepCount: number;
};

export type CookSessionStepView = {
  stepIndex: number;
  visitCount: number;
  durationMs: number;
  firstEnteredAt: string;
  lastEnteredAt: string;
};

export type CookSessionView = {
  id: string;
  recipeId: string;
  status: CookSessionStatus;
  currentStepIndex: number;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalDurationMs: number;
  steps: CookSessionStepView[];
  recipe: CookSessionRecipe;
};

export type CreateCookSessionBody = {
  recipeId: string;
  currentStepIndex?: number;
};

export type PatchCookSessionBody = {
  currentStepIndex?: number;
  status?: CookSessionStatus;
};

export type ListCookSessionsQuery = {
  page?: number;
  pageSize?: number;
  status?: CookSessionStatus;
};

export function isApiRecipeId(id: string | null | undefined): boolean {
  return !!id && !id.startsWith('seed:');
}
