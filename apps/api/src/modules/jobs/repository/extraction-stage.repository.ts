import type { ExtractionStage, PipelineStage, Prisma, StageStatus } from '@prisma/client';

export interface CreateExtractionStageInput {
  jobId: string;
  stage: PipelineStage;
  status?: StageStatus;
  attempt?: number;
}

export interface UpdateExtractionStageInput {
  status?: StageStatus;
  progress?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  error?: Prisma.InputJsonValue | null;
}

export interface IExtractionStageRepository {
  create(input: CreateExtractionStageInput): Promise<ExtractionStage>;
  findByJobAndStage(jobId: string, stage: PipelineStage): Promise<ExtractionStage | null>;
  update(id: string, input: UpdateExtractionStageInput): Promise<ExtractionStage>;
  listByJobId(jobId: string): Promise<ExtractionStage[]>;
}
