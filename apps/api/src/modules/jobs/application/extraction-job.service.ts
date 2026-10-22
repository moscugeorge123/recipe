import type { ExtractionJob, JobStatus, Prisma } from '@prisma/client';

import type { AppLogger } from '../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../infrastructure/logging/logger.js';
import { tracePhotoImport } from '../../../infrastructure/logging/photo-import-trace.js';
import { assertSafeUrl } from '../../../infrastructure/security/ssrf-guard.js';
import type { StorageProvider } from '../../../infrastructure/storage/storage-provider.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCode } from '../../../shared/errors/error-codes.js';
import type { QueueProvider } from '../../../infrastructure/queues/bullmq/queue-provider.js';
import {
  JobAlreadyCompletedError,
  JobCancelledError,
  JobNotFoundError,
} from '../../../shared/errors/extraction-errors.js';
import { hashUrl, legacyNormalizeUrl, normalizeUrl } from '../../../shared/utils/url.js';
import type { ContentProviderRegistry } from '../../content/domain/types.js';
import {
  buildPhotoSourceUrl,
  newPhotoImportId,
  photoStorageKey,
  sniffImageType,
  type PhotoMimeType,
} from '../../content/providers/photo/photo-source.js';
import { DEFAULT_PROFILE_ID } from '../../profiles/domain/profile.js';
import { parseJobOptions } from '../domain/job-options.js';
import { JobStateMachine } from '../domain/job-state-machine.js';
import type { IExtractionJobRepository } from '../repository/extraction-job.repository.js';
import type { IRecipeSourceRepository } from '../../recipes/repository/recipe-source.repository.js';

export const EXTRACTION_JOB_NAME = 'extract';

/**
 * A queued or running job older than this is treated as abandoned (a worker that died), so a
 * new request for the same link starts a fresh job instead of joining it.
 */
export const ACTIVE_JOB_WINDOW_MS = 15 * 60 * 1000;

export interface CreateExtractionJobInput {
  url: string;
  outputLanguage?: string;
  forceRefresh?: boolean;
  options?: Prisma.InputJsonValue;
}

export interface CreatePhotoJobInput {
  /** Decoded image files, one per page, in reading order. */
  images: Buffer[];
  outputLanguage?: string;
}

/** Pages per photo import: a cookbook spread or a few cards, not a whole book. */
export const MAX_PHOTO_PAGES = 6;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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

export interface JobListItem {
  id: string;
  status: JobStatus;
  progress: number;
  url: string;
  title: string | null;
  recipeId: string | null;
  error: unknown;
  createdAt: Date;
  completedAt: Date | null;
}

export class ExtractionJobService {
  private readonly stateMachine = new JobStateMachine();
  /** Requests for the same account and link that are being handled right now. */
  private readonly inFlight = new Map<string, Promise<CreateExtractionJobResult>>();

  constructor(
    private readonly jobRepo: IExtractionJobRepository,
    private readonly sourceRepo: IRecipeSourceRepository,
    private readonly registry: ContentProviderRegistry,
    private readonly queue: QueueProvider,
    private readonly log: AppLogger = silentLogger(),
    private readonly storage?: StorageProvider,
  ) {}

  async createJob(
    userId: string,
    input: CreateExtractionJobInput,
  ): Promise<CreateExtractionJobResult> {
    await assertSafeUrl(input.url);

    const options = parseJobOptions(input.options);
    if (options.selectedThumbnailUrl) {
      await assertSafeUrl(options.selectedThumbnailUrl);
    }

    const normalizedUrl = normalizeUrl(input.url);
    const urlHash = hashUrl(normalizedUrl);

    // Two requests for the same link at the same moment (a double tap, a re-delivered share)
    // share one result instead of racing to create two sources and two jobs.
    const key = `${userId}:${urlHash}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const pending = this.createJobFor(userId, input, normalizedUrl, urlHash);
    this.inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /**
   * Queues an import from photos of a cookbook page, recipe card or handwritten note. The pages
   * are checked, stored, and read by the same pipeline as every other source. Each upload is its
   * own import: photos are never de-duplicated against earlier ones.
   */
  async createPhotoJob(
    userId: string,
    input: CreatePhotoJobInput,
  ): Promise<CreateExtractionJobResult> {
    const pages = input.images.map((data, position) => ({
      index: position + 1,
      bytes: data.byteLength,
    }));
    try {
      return await this.storeAndQueuePhotoJob(userId, input);
    } catch (error: unknown) {
      tracePhotoImport({
        step: 'photo.intake',
        phase: 'failed',
        data: { userId, outputLanguage: input.outputLanguage ?? 'en', pages },
        error,
      });
      throw error;
    }
  }

  private async storeAndQueuePhotoJob(
    userId: string,
    input: CreatePhotoJobInput,
  ): Promise<CreateExtractionJobResult> {
    if (!this.storage) {
      throw new AppError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        statusCode: 503,
        message: 'Photo import is not available',
      });
    }
    if (input.images.length === 0 || input.images.length > MAX_PHOTO_PAGES) {
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        message: `Send between 1 and ${String(MAX_PHOTO_PAGES)} photos`,
      });
    }

    const types: PhotoMimeType[] = [];
    for (const [position, data] of input.images.entries()) {
      if (data.byteLength > MAX_PHOTO_BYTES) {
        throw new AppError({
          code: ErrorCode.PAYLOAD_TOO_LARGE,
          statusCode: 413,
          message: `Photo ${String(position + 1)} is larger than ${String(MAX_PHOTO_BYTES / (1024 * 1024))} MB`,
        });
      }
      const type = sniffImageType(data);
      if (!type) {
        throw new AppError({
          code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          statusCode: 415,
          message: `Photo ${String(position + 1)} must be a JPEG, PNG or WebP image`,
        });
      }
      types.push(type);
    }

    const importId = newPhotoImportId();
    const originalUrl = buildPhotoSourceUrl(importId, types);
    const storedPages = input.images.map((data, position) => {
      const type = types[position] as PhotoMimeType;
      return {
        index: position + 1,
        bytes: data.byteLength,
        mimeType: type,
        storageKey: photoStorageKey(importId, position + 1, type),
      };
    });
    for (const [position, data] of input.images.entries()) {
      const page = storedPages[position];
      if (!page) continue;
      await this.storage.upload(page.storageKey, data, { contentType: page.mimeType });
    }

    const normalizedUrl = originalUrl;
    const source = await this.sourceRepo.findOrCreate({
      sourceType: 'PHOTO',
      originalUrl,
      normalizedUrl,
      urlHash: hashUrl(normalizedUrl),
    });
    const job = await this.jobRepo.create({
      recipeSourceId: source.id,
      requestedByUserId: userId,
      outputLanguage: input.outputLanguage ?? 'en',
      options: { extractImages: true },
    });
    await this.queue.enqueue(EXTRACTION_JOB_NAME, { jobId: job.id });
    this.log.info(
      { step: 'queue.enqueue', jobId: job.id, sourceType: 'PHOTO', pages: input.images.length },
      'queue.enqueue completed',
    );
    tracePhotoImport({
      jobId: job.id,
      step: 'photo.intake',
      phase: 'completed',
      data: {
        userId,
        importId,
        sourceUrl: originalUrl,
        outputLanguage: input.outputLanguage ?? 'en',
        pages: storedPages,
      },
    });

    return { jobId: job.id, status: 'queued' };
  }

  private async createJobFor(
    userId: string,
    input: CreateExtractionJobInput,
    normalizedUrl: string,
    urlHash: string,
  ): Promise<CreateExtractionJobResult> {
    const sourceType = this.registry.detectSourceType(input.url);

    let source = await this.sourceRepo.findByUrlHash(urlHash);

    if (!source) {
      // A source saved before links were normalised this far keeps its old hash.
      const legacyHash = hashUrl(legacyNormalizeUrl(input.url));
      if (legacyHash !== urlHash) source = await this.sourceRepo.findByUrlHash(legacyHash);
    }

    source ??= await this.sourceRepo.findOrCreate({
      sourceType,
      originalUrl: input.url,
      normalizedUrl,
      urlHash,
    });

    if (!input.forceRefresh) {
      const existing = await this.jobRepo.findLatestCompletedBySourceId(source.id);
      if (existing?.recipeId) {
        // The recipe is shared across accounts; make sure this caller gets their own copy of it.
        await this.jobRepo.linkRecipeToUser(userId, existing.recipeId);
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

    // The same link is already importing for this account: hand back that job.
    const active = await this.jobRepo.findActiveBySourceId(
      source.id,
      userId,
      new Date(Date.now() - ACTIVE_JOB_WINDOW_MS),
    );
    if (active) {
      this.log.info(
        { step: 'http.extract.create', jobId: active.id, url: input.url, joinedActive: true },
        'http.extract.create completed',
      );
      return { jobId: active.id, status: 'queued', deduplicated: false };
    }

    const job = await this.jobRepo.create({
      recipeSourceId: source.id,
      requestedByUserId: userId,
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

  /**
   * Jobs are visible to the account that requested them. Jobs from before accounts existed
   * (no requester) belong to the default profile. A completed job is also visible to anyone who
   * holds its recipe, because de-duplicated imports hand back the original job id.
   */
  private async canViewJob(job: ExtractionJob, userId: string): Promise<boolean> {
    if (job.requestedByUserId === userId) return true;
    if (job.requestedByUserId === null && userId === DEFAULT_PROFILE_ID) return true;
    if (job.status === 'COMPLETED' && job.recipeId) {
      return this.jobRepo.userHasRecipe(userId, job.recipeId);
    }
    return false;
  }

  private isJobOwner(job: ExtractionJob, userId: string): boolean {
    return (
      job.requestedByUserId === userId ||
      (job.requestedByUserId === null && userId === DEFAULT_PROFILE_ID)
    );
  }

  /** The account's recent import jobs, newest first, so a fresh install can rebuild its history. */
  async listJobs(userId: string, limit = 20): Promise<JobListItem[]> {
    const jobs = await this.jobRepo.listByRequester(
      userId,
      limit,
      userId === DEFAULT_PROFILE_ID,
    );
    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      url: job.recipeSource.originalUrl,
      title: job.recipe?.title ?? null,
      recipeId: job.recipeId,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));
  }

  async getJobStatus(userId: string, jobId: string): Promise<JobStatusView> {
    const job = await this.jobRepo.findById(jobId);
    if (!job || !(await this.canViewJob(job, userId))) {
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

  async cancelJob(userId: string, jobId: string): Promise<ExtractionJob> {
    const job = await this.jobRepo.findById(jobId);
    if (!job || !this.isJobOwner(job, userId)) {
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
