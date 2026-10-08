import type { Prisma, PrismaClient } from '@prisma/client';

import type { LogQuery, LogReader } from '../../../infrastructure/logging/log-reader.js';
import { NotFoundError } from '../../../shared/errors/app-error.js';
import {
  assembleImportDetail,
  assembleImportListItem,
  assembleSummary,
  assembleUsage,
  type AiUsageInput,
  type DashboardSummary,
  type ImportDetail,
  type ImportJobInput,
  type ImportListItem,
  type UsageReport,
} from '../domain/assemble.js';

const jobInclude = {
  recipe: { select: { id: true, title: true, description: true } },
  recipeSource: { select: { sourceType: true, originalUrl: true } },
  stages: true,
  aiUsage: { orderBy: { createdAt: 'asc' as const } },
  providerUsage: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ExtractionJobInclude;

type DashboardJob = Prisma.ExtractionJobGetPayload<{ include: typeof jobInclude }>;

function toAiInput(row: DashboardJob['aiUsage'][number]): AiUsageInput {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    operation: row.operation,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    estimatedCostUsd: row.estimatedCostUsd,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
  };
}

function toJobInput(job: DashboardJob): ImportJobInput {
  return {
    id: job.id,
    recipeId: job.recipeId,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    recipe: job.recipe,
    recipeSource: {
      sourceType: job.recipeSource.sourceType,
      originalUrl: job.recipeSource.originalUrl,
    },
    stages: job.stages.map((stage) => ({
      stage: stage.stage,
      status: stage.status,
      attempt: stage.attempt,
      progress: stage.progress,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      durationMs: stage.durationMs,
      error: stage.error,
    })),
    aiUsage: job.aiUsage.map(toAiInput),
    providerUsage: job.providerUsage.map((row) => ({
      id: row.id,
      provider: row.provider,
      operation: row.operation,
      sourceType: row.sourceType,
      units: row.units,
      estimatedCostUsd: row.estimatedCostUsd,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    })),
  };
}

export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logReader: LogReader,
  ) {}

  async summary(): Promise<DashboardSummary> {
    const jobs = await this.prisma.extractionJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: jobInclude,
    });
    return assembleSummary(jobs.map(toJobInput));
  }

  async listImports(
    page: number,
    pageSize: number,
  ): Promise<{ items: ImportListItem[]; total: number }> {
    const [total, jobs] = await Promise.all([
      this.prisma.extractionJob.count(),
      this.prisma.extractionJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: jobInclude,
      }),
    ]);

    return {
      items: jobs.map((job) => assembleImportListItem(toJobInput(job))),
      total,
    };
  }

  async getImport(jobId: string): Promise<ImportDetail> {
    const job = await this.prisma.extractionJob.findUnique({
      where: { id: jobId },
      include: jobInclude,
    });
    if (job === null) {
      throw new NotFoundError({ message: 'Import job not found' });
    }
    return assembleImportDetail(toJobInput(job));
  }

  async usage(): Promise<UsageReport> {
    const rows = await this.prisma.aIUsage.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return assembleUsage(rows.map(toAiInput));
  }

  logs(query: LogQuery): ReturnType<LogReader['read']> {
    return this.logReader.read(query);
  }
}
