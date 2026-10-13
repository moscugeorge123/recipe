import type { PrismaClient, ProviderUsage } from '@prisma/client';

export interface CreateProviderUsageInput {
  jobId: string;
  provider: string;
  operation: string;
  sourceType: string;
  units: number;
  estimatedCostUsd: number;
  durationMs: number;
}

export interface IProviderUsageRepository {
  create(input: CreateProviderUsageInput): Promise<ProviderUsage>;
  findByJobId(jobId: string): Promise<ProviderUsage[]>;
}

export class PrismaProviderUsageRepository implements IProviderUsageRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateProviderUsageInput): Promise<ProviderUsage> {
    return this.db.providerUsage.create({
      data: {
        jobId: input.jobId,
        provider: input.provider,
        operation: input.operation,
        sourceType: input.sourceType,
        units: input.units,
        estimatedCostUsd: input.estimatedCostUsd,
        durationMs: input.durationMs,
      },
    });
  }

  findByJobId(jobId: string): Promise<ProviderUsage[]> {
    return this.db.providerUsage.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
