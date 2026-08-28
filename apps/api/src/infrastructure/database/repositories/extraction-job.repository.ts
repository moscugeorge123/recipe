import type { ExtractionJob, PrismaClient } from '@prisma/client';

import type {
  CreateExtractionJobInput,
  IExtractionJobRepository,
  UpdateExtractionJobInput,
} from '../../../modules/jobs/repository/extraction-job.repository.js';

export class PrismaExtractionJobRepository implements IExtractionJobRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateExtractionJobInput): Promise<ExtractionJob> {
    return this.db.extractionJob.create({
      data: {
        recipeSourceId: input.recipeSourceId,
        outputLanguage: input.outputLanguage,
        options: input.options ?? {},
      },
    });
  }

  findById(id: string): Promise<ExtractionJob | null> {
    return this.db.extractionJob.findUnique({ where: { id } });
  }

  update(id: string, input: UpdateExtractionJobInput): Promise<ExtractionJob> {
    const data: Record<string, unknown> = {};

    if (input.status !== undefined) data['status'] = input.status;
    if (input.progress !== undefined) data['progress'] = input.progress;
    if (input.currentStage !== undefined) data['currentStage'] = input.currentStage;
    if (input.recipeId !== undefined) data['recipeId'] = input.recipeId;
    if (input.sourceLanguage !== undefined) data['sourceLanguage'] = input.sourceLanguage;
    if (input.error !== undefined) data['error'] = input.error;
    if (input.retryCount !== undefined) data['retryCount'] = input.retryCount;
    if (input.startedAt !== undefined) data['startedAt'] = input.startedAt;
    if (input.completedAt !== undefined) data['completedAt'] = input.completedAt;

    return this.db.extractionJob.update({
      where: { id },
      data,
    });
  }

  findLatestCompletedBySourceId(recipeSourceId: string): Promise<ExtractionJob | null> {
    return this.db.extractionJob.findFirst({
      where: {
        recipeSourceId,
        status: 'COMPLETED',
        recipeId: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async clearRecipeIdExcept(recipeId: string, jobId: string): Promise<void> {
    await this.db.extractionJob.updateMany({
      where: { recipeId, id: { not: jobId } },
      data: { recipeId: null },
    });
  }
}
