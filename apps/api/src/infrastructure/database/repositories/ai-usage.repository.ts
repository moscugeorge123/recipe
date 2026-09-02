import type { AIUsage, PrismaClient } from '@prisma/client';

export type AIUsageLink =
  | {
      jobId: string;
      userId?: string;
      recipeRevisionId?: string;
      pantryItemId?: string;
      nutritionSnapshotId?: string;
    }
  | {
      jobId?: string;
      userId: string;
      recipeRevisionId?: string;
      pantryItemId?: string;
      nutritionSnapshotId?: string;
    };

export type CreateAIUsageInput = AIUsageLink & {
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
};

export interface IAIUsageRepository {
  create(input: CreateAIUsageInput): Promise<AIUsage>;
  findByJobId(jobId: string): Promise<AIUsage[]>;
}

export class PrismaAIUsageRepository implements IAIUsageRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateAIUsageInput): Promise<AIUsage> {
    return this.db.aIUsage.create({
      data: {
        ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.recipeRevisionId !== undefined
          ? { recipeRevisionId: input.recipeRevisionId }
          : {}),
        ...(input.pantryItemId !== undefined ? { pantryItemId: input.pantryItemId } : {}),
        ...(input.nutritionSnapshotId !== undefined
          ? { nutritionSnapshotId: input.nutritionSnapshotId }
          : {}),
        provider: input.provider,
        model: input.model,
        operation: input.operation,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCostUsd: input.estimatedCostUsd,
        durationMs: input.durationMs,
      },
    });
  }

  findByJobId(jobId: string): Promise<AIUsage[]> {
    return this.db.aIUsage.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
