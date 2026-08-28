import type { ExtractionStage, PipelineStage, PrismaClient } from '@prisma/client';

import type {
  CreateExtractionStageInput,
  IExtractionStageRepository,
  UpdateExtractionStageInput,
} from '../../../modules/jobs/repository/extraction-stage.repository.js';

export class PrismaExtractionStageRepository implements IExtractionStageRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateExtractionStageInput): Promise<ExtractionStage> {
    return this.db.extractionStage.create({
      data: {
        jobId: input.jobId,
        stage: input.stage,
        status: input.status ?? 'PENDING',
        attempt: input.attempt ?? 1,
      },
    });
  }

  findByJobAndStage(jobId: string, stage: PipelineStage): Promise<ExtractionStage | null> {
    return this.db.extractionStage.findFirst({
      where: { jobId, stage },
      orderBy: { attempt: 'desc' },
    });
  }

  update(id: string, input: UpdateExtractionStageInput): Promise<ExtractionStage> {
    const data: Record<string, unknown> = {};

    if (input.status !== undefined) data['status'] = input.status;
    if (input.progress !== undefined) data['progress'] = input.progress;
    if (input.startedAt !== undefined) data['startedAt'] = input.startedAt;
    if (input.completedAt !== undefined) data['completedAt'] = input.completedAt;
    if (input.durationMs !== undefined) data['durationMs'] = input.durationMs;
    if (input.error !== undefined) data['error'] = input.error;

    return this.db.extractionStage.update({ where: { id }, data });
  }

  listByJobId(jobId: string): Promise<ExtractionStage[]> {
    return this.db.extractionStage.findMany({
      where: { jobId },
      orderBy: [{ stage: 'asc' }, { attempt: 'asc' }],
    });
  }
}
