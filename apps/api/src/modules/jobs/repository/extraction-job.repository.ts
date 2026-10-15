import type { ExtractionJob, JobStatus, Prisma } from '@prisma/client';

export interface CreateExtractionJobInput {
  recipeSourceId: string;
  /** Account that submitted the import; null for system-created jobs. */
  requestedByUserId?: string | null;
  outputLanguage: string;
  options?: Prisma.InputJsonValue;
}

export interface UpdateExtractionJobInput {
  status?: JobStatus;
  progress?: number;
  currentStage?: string | null;
  recipeId?: string | null;
  sourceLanguage?: string | null;
  error?: Prisma.InputJsonValue | null;
  retryCount?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface IExtractionJobRepository {
  create(input: CreateExtractionJobInput): Promise<ExtractionJob>;
  findById(id: string): Promise<ExtractionJob | null>;
  update(id: string, input: UpdateExtractionJobInput): Promise<ExtractionJob>;
  findLatestCompletedBySourceId(recipeSourceId: string): Promise<ExtractionJob | null>;
  clearRecipeIdExcept(recipeId: string, jobId: string): Promise<void>;
  /**
   * Gives the user their own copy of an existing recipe (UserRecipe + original revision +
   * categories). Idempotent: does nothing when the user already has it.
   */
  linkRecipeToUser(userId: string, recipeId: string): Promise<void>;
  userHasRecipe(userId: string, recipeId: string): Promise<boolean>;
}
