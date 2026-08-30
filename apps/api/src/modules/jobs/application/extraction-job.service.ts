import type { ExtractionJob, JobStatus, Prisma } from '@prisma/client';

import type { AppLogger } from '../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../infrastructure/logging/logger.js';
import { assertSafeUrl } from '../../../infrastructure/security/ssrf-guard.js';
import type { QueueProvider } from '../../../infrastructure/queues/bullmq/queue-provider.js';
import {
  JobAlreadyCompletedError,
  JobCancelledError,
  JobNotFoundError,
} from '../../../shared/errors/extraction-errors.js';
import { hashUrl, normalizeUrl } from '../../../shared/utils/url.js';
import type { ContentProviderRegistry } from '../../content/domain/types.js';
import { parseJobOptions } from '../domain/job-options.js';
import { JobStateMachine } from '../domain/job-state-machine.js';
import type { IExtractionJobRepository } from '../repository/extraction-job.repository.js';
import type { IRecipeSourceRepository } from '../../recipes/repository/recipe-source.repository.js';

export const EXTRACTION_JOB_NAME = 'extract';

export interface CreateExtractionJobInput {
  url: string;
  outputLanguage?: string;
  forceRefresh?: boolean;
  options?: Prisma.InputJsonValue;
}

export interface CreateExtractionJobResult {
  jobId: string;
  status: 'queued' | 'completed';
  recipeId?: string;
  deduplicated?: boolean;
}

export interface JobStatusView {
  id: string;
  status: JobStatus;
  progress: number;
  currentStage: string | null;
  recipeId: string | null;
  error: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
}

export class ExtractionJobService {
  private readonly stateMachine = new JobStateMachine();

  constructor(
    private readonly jobRepo: IExtractionJobRepository,
    private readonly sourceRepo: IRecipeSourceRepository,
    private readonly registry: ContentProviderRegistry,
    private readonly queue: QueueProvider,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  async createJob(input: CreateExtractionJobInput): Promise<CreateExtractionJobResult> {
    await assertSafeUrl(input.url);

    const options = parseJobOptions(input.options);
    if (options.selectedThumbnailUrl) {
      await assertSafeUrl(options.selectedThumbnailUrl);
    }

    const normalizedUrl = normalizeUrl(input.url);
    const urlHash = hashUrl(normalizedUrl);
    const sourceType = this.registry.detectSourceType(input.url);

    let source = await this.sourceRepo.findByUrlHash(urlHash);

    if (!source) {
      source = await this.sourceRepo.create({
        sourceType,
        originalUrl: input.url,
        normalizedUrl,
        urlHash,
      });
    }

    if (!input.forceRefresh) {
      const existing = await this.jobRepo.findLatestCompletedBySourceId(source.id);
      if (existing?.recipeId) {
        this.log.info(
          { step: 'http.extract.create', jobId: existing.id, url: input.url, deduplicated: true },
          'http.extract.create completed',
        );
        return {
          jobId: existing.id,
          status: 'completed',
          recipeId: existing.recipeId,
          deduplicated: true,
        };
      }
    }

    const job = await this.jobRepo.create({
      recipeSourceId: source.id,
      outputLanguage: input.outputLanguage ?? 'en',
      options: input.options ?? {},
    });

    await this.queue.enqueue(EXTRACTION_JOB_NAME, { jobId: job.id });
    this.log.info(
      { step: 'queue.enqueue', jobId: job.id, sourceType, url: input.url },
      'queue.enqueue completed',
    );

    return { jobId: job.id, status: 'queued' };
  }

  async getJobStatus(jobId: string): Promise<JobStatusView> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new JobNotFoundError();
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      recipeId: job.recipeId,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  async cancelJob(jobId: string): Promise<ExtractionJob> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new JobNotFoundError();
    }

    if (job.status === 'COMPLETED') {
      throw new JobAlreadyCompletedError();
    }

    if (job.status === 'CANCELLED') {
      throw new JobCancelledError();
    }

    if (!this.stateMachine.canCancel(job.status)) {
      throw new JobCancelledError({
        message: 'Job cannot be cancelled in its current state',
      });
    }

    const updated = await this.jobRepo.update(jobId, {
      status: 'CANCELLED',
      completedAt: new Date(),
    });
    this.log.info(
      { step: 'http.extract.cancel', jobId, previousStatus: job.status },
      'http.extract.cancel completed',
    );
    return updated;
  }
}
