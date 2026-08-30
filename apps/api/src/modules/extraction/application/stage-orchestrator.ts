import type { Prisma } from '@prisma/client';
import type { JobStatus, PipelineStage } from '@prisma/client';

import type { AppConfig } from '../../../config/env.js';
import { createAIProviders } from '../../../infrastructure/ai/create-ai-providers.js';
import { AIUsageTracker } from '../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { DEFAULT_PRICING } from '../../../infrastructure/ai/usage/pricing.js';
import type { StorageProvider } from '../../../infrastructure/storage/storage-provider.js';
import { ExtractionFailedError } from '../../../shared/errors/extraction-errors.js';
import type { ContentAcquisitionService } from '../../content/application/content-acquisition.service.js';
import type { AcquiredContent } from '../../content/domain/types.js';
import { EvidenceBuilder } from '../../evidence/application/evidence-builder.js';
import type { EvidenceItem } from '../../evidence/domain/types.js';
import { ConfidenceCalculator } from '../../confidence/application/confidence-calculator.js';
import { RecipeNormalizer } from '../../normalization/application/recipe-normalizer.js';
import { RecipeExtractor } from '../../recipes/application/recipe-extractor.js';
import { primaryLanguage } from '../../recipes/prompts/recipe-extraction-v1.js';
import type { MediaProcessingService } from '../../media/application/media-processing.service.js';
import type { IRecipeRepository } from '../../recipes/repository/recipe.repository.js';
import { RecipeValidator } from '../../validation/application/recipe-validator.js';
import { ProgressCalculator } from '../../jobs/application/progress-calculator.js';
import { parseJobOptions, type JobOptions } from '../../jobs/domain/job-options.js';
import { JobStateMachine } from '../../jobs/domain/job-state-machine.js';
import {
  CONTENT_ACQUIRED_STATUS,
  PIPELINE_STAGE_ORDER,
  STAGE_TO_JOB_STATUS,
} from '../../jobs/domain/job-status.js';
import type { IExtractionJobRepository } from '../../jobs/repository/extraction-job.repository.js';
import type { IExtractionStageRepository } from '../../jobs/repository/extraction-stage.repository.js';
import type { IMediaAssetRepository } from '../../media/repository/media-asset.repository.js';
import type { IExtractionEvidenceRepository } from '../../../infrastructure/database/repositories/extraction-evidence.repository.js';
import type { ITranscriptRepository } from '../../../infrastructure/database/repositories/transcript.repository.js';
import type { IOCRRepository } from '../../../infrastructure/database/repositories/ocr.repository.js';
import type { IVisionRepository } from '../../../infrastructure/database/repositories/vision.repository.js';
import type { IAIUsageRepository } from '../../../infrastructure/database/repositories/ai-usage.repository.js';
import type { Transcript } from '../../transcription/domain/types.js';
import type { OCRResult } from '../../ocr/domain/types.js';
import type { VisionAnalysis } from '../../vision/domain/types.js';

export interface PipelineContext {
  jobId: string;
  sourceUrl: string;
  outputLanguage: string;
  options?: JobOptions;
  acquiredContent?: AcquiredContent;
  evidence?: EvidenceItem[];
  transcript?: Transcript;
  ocrResults?: OCRResult[];
  visionAnalyses?: VisionAnalysis[];
  recipeId?: string;
}

export type StageHandler = (ctx: PipelineContext) => Promise<void>;

/** Status applied to the job after a stage finishes successfully. */
const AFTER_STAGE_STATUS: Partial<Record<PipelineStage, JobStatus>> = {
  ACQUIRING_CONTENT: CONTENT_ACQUIRED_STATUS,
  VALIDATING_RECIPE: 'COMPLETED',
};

export class StageOrchestrator {
  private readonly stateMachine = new JobStateMachine();
  private readonly progress: ProgressCalculator;

  constructor(
    private readonly jobRepo: IExtractionJobRepository,
    private readonly stageRepo: IExtractionStageRepository,
    private readonly handlers: Partial<Record<PipelineStage, StageHandler>>,
  ) {
    this.progress = new ProgressCalculator(PIPELINE_STAGE_ORDER);
  }

  async runStages(ctx: PipelineContext): Promise<void> {
    let previousStatus: JobStatus | undefined;

    for (const stage of PIPELINE_STAGE_ORDER) {
      const job = await this.jobRepo.findById(ctx.jobId);
      if (!job || job.status === 'CANCELLED' || job.status === 'COMPLETED' || job.status === 'FAILED') {
        return;
      }

      ctx.options = parseJobOptions(job.options);

      const existing = await this.stageRepo.findByJobAndStage(ctx.jobId, stage);
      if (existing?.status === 'COMPLETED') {
        previousStatus = AFTER_STAGE_STATUS[stage] ?? STAGE_TO_JOB_STATUS[stage];
        continue;
      }

      const runningStatus = this.resolveRunningStatus(stage, job.status);
      this.stateMachine.assertTransition(job.status, runningStatus);

      const stageRecord =
        existing ??
        (await this.stageRepo.create({
          jobId: ctx.jobId,
          stage,
          status: 'RUNNING',
        }));

      const startedAt = stageRecord.startedAt ?? new Date();
      if (!stageRecord.startedAt) {
        await this.stageRepo.update(stageRecord.id, { startedAt, status: 'RUNNING' });
      }

      await this.jobRepo.update(ctx.jobId, {
        status: runningStatus,
        currentStage: stage.toLowerCase(),
        progress: this.progress.whileStageRunning(stage),
        ...(job.startedAt ? {} : { startedAt }),
      });

      try {
        const handler = this.handlers[stage];
        if (handler) {
          await handler(ctx);
        }

        const completedAt = new Date();
        await this.stageRepo.update(stageRecord.id, {
          status: 'COMPLETED',
          progress: 100,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        });

        const afterStatus = AFTER_STAGE_STATUS[stage];
        if (afterStatus === 'COMPLETED') {
          await this.jobRepo.update(ctx.jobId, {
            status: 'COMPLETED',
            progress: 100,
            currentStage: 'completed',
            completedAt,
          });
          return;
        }

        if (afterStatus) {
          await this.jobRepo.update(ctx.jobId, {
            status: afterStatus,
            progress: this.progress.afterStageCompleted(stage),
            currentStage: afterStatus.toLowerCase(),
          });
          previousStatus = afterStatus;
        } else {
          await this.jobRepo.update(ctx.jobId, {
            progress: this.progress.afterStageCompleted(stage),
          });
          previousStatus = STAGE_TO_JOB_STATUS[stage];
        }
      } catch (error: unknown) {
        const serialized = serializeStageError(error);
        await this.stageRepo.update(stageRecord.id, {
          status: 'FAILED',
          completedAt: new Date(),
          error: serialized,
        });

        await this.jobRepo.update(ctx.jobId, {
          status: 'FAILED',
          error: serialized,
          completedAt: new Date(),
        });

        throw error;
      }
    }

    void previousStatus;
  }

  private resolveRunningStatus(stage: PipelineStage, currentStatus: JobStatus): JobStatus {
    if (stage === 'ACQUIRING_CONTENT') {
      return 'ACQUIRING_CONTENT';
    }

    if (stage === 'PROCESSING_MEDIA' && currentStatus === CONTENT_ACQUIRED_STATUS) {
      return 'PROCESSING_MEDIA';
    }

    return STAGE_TO_JOB_STATUS[stage];
  }
}

export interface StageHandlerDeps {
  contentAcquisition: ContentAcquisitionService;
  mediaProcessing: MediaProcessingService | null;
  recipeRepo: IRecipeRepository;
  jobRepo: IExtractionJobRepository;
  sourceRepo: {
    findById(id: string): Promise<{ id: string; originalUrl: string; metadata: unknown } | null>;
    updateMetadata(id: string, metadata: Prisma.InputJsonValue): Promise<unknown>;
  };
  mediaAssetRepo: IMediaAssetRepository;
  evidenceRepo: IExtractionEvidenceRepository;
  transcriptRepo: ITranscriptRepository;
  ocrRepo: IOCRRepository;
  visionRepo: IVisionRepository;
  aiUsageRepo: IAIUsageRepository;
  storage: StorageProvider;
  config: AppConfig;
}

export function createDefaultStageHandlers(deps: StageHandlerDeps): Partial<Record<PipelineStage, StageHandler>> {
  const evidenceBuilder = new EvidenceBuilder();
  const recipeNormalizer = new RecipeNormalizer();
  const confidenceCalculator = new ConfidenceCalculator();
  const recipeValidator = new RecipeValidator();

  return {
    ACQUIRING_CONTENT: async (ctx): Promise<void> => {
      const job = await deps.jobRepo.findById(ctx.jobId);
      if (!job) {
        throw new ExtractionFailedError({ message: 'Job not found during acquisition' });
      }

      const source = await deps.sourceRepo.findById(job.recipeSourceId);
      if (!source) {
        throw new ExtractionFailedError({ message: 'Recipe source not found' });
      }

      ctx.sourceUrl = source.originalUrl;
      ctx.acquiredContent = await deps.contentAcquisition.acquire(
        source.originalUrl,
        ctx.jobId,
        ctx.outputLanguage,
      );

      const options = parseJobOptions(job.options);
      ctx.options = options;

      const existingMeta =
        source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)
          ? (source.metadata as Record<string, unknown>)
          : {};

      const metadata: Record<string, unknown> = {
        ...existingMeta,
        author: ctx.acquiredContent.author ?? null,
        title: ctx.acquiredContent.title ?? null,
        language: ctx.acquiredContent.language ?? null,
        ...ctx.acquiredContent.metadata,
      };

      if (options.extractImages) {
        metadata.thumbnailUrl = options.selectedThumbnailUrl ?? ctx.acquiredContent.thumbnailUrl ?? null;
      } else {
        delete metadata.thumbnailUrl;
      }

      await deps.sourceRepo.updateMetadata(source.id, metadata as Prisma.InputJsonValue);

      await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
    },

    PROCESSING_MEDIA: async (ctx): Promise<void> => {
      if (!deps.mediaProcessing || !ctx.acquiredContent?.videoLocalPath) {
        await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
        return;
      }

      const path = await import('node:path');
      const os = await import('node:os');

      await deps.mediaProcessing.processVideo({
        jobId: ctx.jobId,
        videoLocalPath: ctx.acquiredContent.videoLocalPath,
        tempDir: path.join(os.tmpdir(), 'recipe-extraction', ctx.jobId, 'media'),
      });
    },

    TRANSCRIBING: async (ctx): Promise<void> => {
      const audioAssets = await deps.mediaAssetRepo.findByJobAndType(ctx.jobId, 'AUDIO');
      if (audioAssets.length === 0) {
        await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
        return;
      }

      const audioAsset = audioAssets[0];
      if (!audioAsset) {
        return;
      }
      const existing = await deps.transcriptRepo.findByMediaAssetId(audioAsset.id);
      if (existing) {
        return;
      }

      const usageTracker = new AIUsageTracker(deps.aiUsageRepo, DEFAULT_PRICING);
      const ai = createAIProviders(deps.config, usageTracker, ctx.jobId);

      const audioBuffer = await deps.storage.download(audioAsset.storageKey);
      ctx.transcript = await ai.transcription.transcribe({
        data: audioBuffer,
        mimeType: audioAsset.mimeType,
      });

        await deps.transcriptRepo.create({
        mediaAssetId: audioAsset.id,
        language: ctx.transcript.language,
        fullText: ctx.transcript.fullText,
        provider: ctx.transcript.provider,
        segments: ctx.transcript.segments,
      });
    },

    ANALYZING_FRAMES: async (ctx): Promise<void> => {
      const frameAssets = await deps.mediaAssetRepo.findByJobAndType(ctx.jobId, 'FRAME');
      if (frameAssets.length === 0) {
        await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
        return;
      }

      const usageTracker = new AIUsageTracker(deps.aiUsageRepo, DEFAULT_PRICING);
      const ai = createAIProviders(deps.config, usageTracker, ctx.jobId);

      const options =
        ctx.options ?? parseJobOptions((await deps.jobRepo.findById(ctx.jobId))?.options);
      ctx.options = options;
      const maxFrames = options.highAccuracy
        ? Math.max(5, Math.min(12, deps.config.extraction.maxFrames))
        : 5;
      const framesToAnalyze = frameAssets.slice(0, maxFrames);
      const images = await Promise.all(
        framesToAnalyze.map(async (asset, index) => ({
          data: await deps.storage.download(asset.storageKey),
          mimeType: asset.mimeType,
          timestampSeconds: index * deps.config.extraction.frameIntervalSeconds,
        })),
      );

      ctx.visionAnalyses = await ai.vision.analyzeImages(images);

      for (const [index, analysis] of ctx.visionAnalyses.entries()) {
        const asset = framesToAnalyze[index];
        if (asset) {
          await deps.visionRepo.create({
            mediaAssetId: asset.id,
            observations: analysis.observations as unknown as Prisma.InputJsonValue,
            timestampSeconds: analysis.timestampSeconds ?? null,
            provider: analysis.provider as Prisma.InputJsonValue,
          });
        }
      }
    },

    RUNNING_OCR: async (ctx): Promise<void> => {
      const frameAssets = await deps.mediaAssetRepo.findByJobAndType(ctx.jobId, 'FRAME');
      if (frameAssets.length === 0) {
        await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
        return;
      }

      const usageTracker = new AIUsageTracker(deps.aiUsageRepo, DEFAULT_PRICING);
      const ai = createAIProviders(deps.config, usageTracker, ctx.jobId);

      ctx.ocrResults = [];
      const maxOcrFrames = 3;
      for (const [index, asset] of frameAssets.slice(0, maxOcrFrames).entries()) {
        const existing = await deps.ocrRepo.findByMediaAssetId(asset.id);
        if (existing.length > 0) {
          continue;
        }

        const imageBuffer = await deps.storage.download(asset.storageKey);
        try {
          const ocrResult = await ai.ocr.analyzeImage({
            data: imageBuffer,
            mimeType: asset.mimeType,
            timestampSeconds: index * deps.config.extraction.frameIntervalSeconds,
          });

          ctx.ocrResults.push(ocrResult);
          await deps.ocrRepo.create({
            mediaAssetId: asset.id,
            text: ocrResult.text,
            timestampSeconds: ocrResult.timestampSeconds ?? null,
            confidence: ocrResult.confidence,
            boundingBoxes: ocrResult.boundingBoxes,
            provider: ocrResult.provider,
          });
        } catch {
          continue;
        }
      }
    },

    EXTRACTING_RECIPE: async (ctx): Promise<void> => {
      const job = await deps.jobRepo.findById(ctx.jobId);
      if (!job) {
        throw new ExtractionFailedError({ message: 'Job not found during extraction' });
      }

      ctx.evidence = evidenceBuilder.build({
        ...(ctx.acquiredContent ? { acquiredContent: ctx.acquiredContent } : {}),
        ...(ctx.transcript ? { transcript: ctx.transcript } : {}),
        ...(ctx.ocrResults ? { ocrResults: ctx.ocrResults } : {}),
        ...(ctx.visionAnalyses ? { visionAnalyses: ctx.visionAnalyses } : {}),
      });

      if (ctx.evidence.length === 0) {
        throw new ExtractionFailedError({
          message: 'No evidence available to extract a recipe',
        });
      }

      await deps.evidenceRepo.createMany(
        ctx.evidence.map((item) => ({
          jobId: ctx.jobId,
          evidenceType: item.evidenceType,
          value: item.value,
          source: item.source,
          timestampSeconds: item.timestampSeconds ?? null,
          confidence: item.confidence,
          metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      );

      const options = parseJobOptions(job.options);
      ctx.options = options;

      const usageTracker = new AIUsageTracker(deps.aiUsageRepo, DEFAULT_PRICING);
      const ai = createAIProviders(deps.config, usageTracker, ctx.jobId);
      const extractor = new RecipeExtractor(ai.llm);

      const { recipe: extracted, promptVersion, rawExtraction } = await extractor.extract({
        evidence: ctx.evidence,
        outputLanguage: ctx.outputLanguage,
        extractNutrition: options.extractNutrition,
      });

      const normalized = recipeNormalizer.normalize(extracted, ctx.outputLanguage);
      const confidence = confidenceCalculator.calculate(normalized);
      normalized.confidence = confidence;

      const originalPostText =
        ctx.acquiredContent?.description?.trim() ||
        ctx.acquiredContent?.caption?.trim() ||
        null;
      const extractedDescription = normalized.description?.trim() || null;
      const copiedSourceCaption =
        originalPostText !== null &&
        extractedDescription !== null &&
        extractedDescription.localeCompare(originalPostText, undefined, { sensitivity: 'accent' }) === 0 &&
        primaryLanguage(ctx.outputLanguage) !== primaryLanguage(normalized.sourceLanguage);

      const recipeFields = {
        title: normalized.title,
        description: copiedSourceCaption ? null : extractedDescription,
        servings: normalized.servings,
        prepTimeMinutes: normalized.prepTimeMinutes,
        cookTimeMinutes: normalized.cookTimeMinutes,
        totalTimeMinutes: normalized.totalTimeMinutes,
        calories: normalized.calories,
        cuisine: normalized.cuisine,
        nutrition: options.extractNutrition ? normalized.nutrition : null,
        sourceLanguage: normalized.sourceLanguage,
        confidence: normalized.confidence,
        warnings: normalized.warnings,
        promptVersion,
        rawExtraction: rawExtraction as unknown as Prisma.InputJsonValue,
        ingredients: normalized.ingredients.map((ing) => ({
          name: ing.name,
          canonicalName: ing.canonicalName,
          quantity: ing.quantity,
          unit: ing.unit,
          preparation: ing.preparation,
          optional: ing.optional,
          category: ing.category,
          confidence: ing.confidence,
          provenance: ing.provenance,
          warnings: ing.warnings,
          sortOrder: ing.sortOrder,
        })),
        steps: normalized.steps.map((step) => ({
          stepOrder: step.stepOrder,
          instruction: step.instruction,
          durationMinutes: step.durationMinutes,
          temperature: step.temperature,
          stage: step.stage,
          confidence: step.confidence,
          provenance: step.provenance,
          warnings: step.warnings,
        })),
      };

      const existing = await deps.recipeRepo.findBySourceId(job.recipeSourceId);
      const recipe = existing
        ? await deps.recipeRepo.update(existing.id, recipeFields)
        : await deps.recipeRepo.create({
            recipeSourceId: job.recipeSourceId,
            ...recipeFields,
          });

      if (existing) {
        await deps.jobRepo.clearRecipeIdExcept(recipe.id, ctx.jobId);
      }

      ctx.recipeId = recipe.id;
      await deps.jobRepo.update(ctx.jobId, { recipeId: recipe.id });
    },

    NORMALIZING_RECIPE: async (ctx): Promise<void> => {
      if (!ctx.recipeId) {
        const job = await deps.jobRepo.findById(ctx.jobId);
        if (job?.recipeId) {
          ctx.recipeId = job.recipeId;
        }
      }
      await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
    },

    VALIDATING_RECIPE: async (ctx): Promise<void> => {
      const recipeId = ctx.recipeId ?? (await deps.jobRepo.findById(ctx.jobId))?.recipeId;
      if (!recipeId) {
        throw new ExtractionFailedError({ message: 'No recipe to validate' });
      }

      const recipe = await deps.recipeRepo.findById(recipeId);
      if (!recipe) {
        throw new ExtractionFailedError({ message: 'Recipe not found during validation' });
      }

      const normalized = recipeNormalizer.normalize({
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        totalTimeMinutes: recipe.totalTimeMinutes,
        calories: recipe.calories,
        sourceLanguage: recipe.sourceLanguage ?? 'en',
        ingredients: recipe.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity?.toString() ?? null,
          unit: ing.unit,
          preparation: ing.preparation,
          optional: ing.optional,
          confidence: ing.confidence,
        })),
        steps: recipe.steps.map((step) => ({
          stepOrder: step.stepOrder,
          instruction: step.instruction,
          durationMinutes: step.durationMinutes,
          temperature: step.temperature,
          confidence: step.confidence,
        })),
      }, ctx.outputLanguage);

      const validation = recipeValidator.validate(normalized);
      const confidence = confidenceCalculator.calculate({
        ...normalized,
        warnings: validation.warnings as unknown as Prisma.InputJsonValue,
      });

      await deps.recipeRepo.update(recipeId, {
        confidence,
        warnings: validation.warnings as unknown as Prisma.InputJsonValue,
      });
    },
  };
}

function maybeDelay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STDERR_LIMIT = 500;

/** Flatten an error + nested causes/stderr into the JSON stored on job/stage rows. */
export function serializeStageError(error: unknown): { message: string; cause?: string } {
  const message = error instanceof Error ? error.message : 'Stage failed';
  const parts: string[] = [];
  let current: unknown = error instanceof Error ? error.cause : undefined;
  let depth = 0;

  while (current instanceof Error && depth < 4) {
    parts.push(current.message);
    const stderr = readStderr(current);
    if (stderr) {
      parts.push(stderr.slice(0, STDERR_LIMIT));
    }
    current = current.cause;
    depth += 1;
  }

  return parts.length > 0 ? { message, cause: parts.join(' | ') } : { message };
}

function readStderr(error: Error): string | undefined {
  if (!('stderr' in error)) {
    return undefined;
  }
  const raw = (error as { stderr?: unknown }).stderr;
  if (typeof raw === 'string') {
    return raw.trim() || undefined;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8').trim() || undefined;
  }
  return undefined;
}
