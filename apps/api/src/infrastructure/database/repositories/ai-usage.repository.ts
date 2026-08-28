import type { AIUsage, PrismaClient } from '@prisma/client';

export interface CreateAIUsageInput {
  jobId: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}

export interface IAIUsageRepository {
  create(input: CreateAIUsageInput): Promise<AIUsage>;
  findByJobId(jobId: string): Promise<AIUsage[]>;
}

export class PrismaAIUsageRepository implements IAIUsageRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateAIUsageInput): Promise<AIUsage> {
    return this.db.aIUsage.create({
      data: {
        jobId: input.jobId,
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
