import type { Prisma } from '@prisma/client';
import type { JobStatus, PipelineStage } from '@prisma/client';

import type { AppConfig } from '../../../config/env.js';
import { createAIProviders } from '../../../infrastructure/ai/create-ai-providers.js';
import { AIUsageTracker } from '../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { DEFAULT_PRICING } from '../../../infrastructure/ai/usage/pricing.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import type { StorageProvider } from '../../../infrastructure/storage/storage-provider.js';
import { isAppError } from '../../../shared/errors/app-error.js';
import { ExtractionFailedError } from '../../../shared/errors/extraction-errors.js';
import type { ContentAcquisitionService } from '../../content/application/content-acquisition.service.js';
import type { AcquiredContent } from '../../content/domain/types.js';
import { EvidenceBuilder } from '../../evidence/application/evidence-builder.js';
import type { EvidenceItem } from '../../evidence/domain/types.js';
import { ConfidenceCalculator } from '../../confidence/application/confidence-calculator.js';
import { RecipeNormalizer } from '../../normalization/application/recipe-normalizer.js';
import {
  assertExtractedRecipeHasContent,
  assertFoodRecipe,
  createRecipeClassifier,
} from '../../recipes/application/recipe-classifier.js';
import { RecipeExtractor } from '../../recipes/application/recipe-extractor.js';
import { primaryLanguage } from '../../recipes/prompts/recipe-extraction-v1.js';
import type { MediaProcessingService } from '../../media/application/media-processing.service.js';
import { createMediaStageHandlers } from './media-stage-handlers.js';
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
    private readonly log: AppLogger = silentLogger(),
  ) {
    this.progress = new ProgressCalculator(PIPELINE_STAGE_ORDER);
  }

  async runStages(ctx: PipelineContext): Promise<void> {
    const log = this.log.child({ jobId: ctx.jobId });
    let previousStatus: JobStatus | undefined;

    for (const stage of PIPELINE_STAGE_ORDER) {
      const job = await this.jobRepo.findById(ctx.jobId);
      if (
        !job ||
        job.status === 'CANCELLED' ||
        job.status === 'COMPLETED' ||
        job.status === 'FAILED'
      ) {
        log.info(
          { step: 'pipeline.stage', stage, status: job?.status ?? 'missing' },
          'pipeline.execute stopped',
        );
        return;
      }

      ctx.options = parseJobOptions(job.options);

      const existing = await this.stageRepo.findByJobAndStage(ctx.jobId, stage);
      if (existing?.status === 'COMPLETED') {
        log.info({ step: 'pipeline.stage', stage, skipped: true }, 'pipeline.stage skipped');
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

      const stageStartedMs = Date.now();
      log.info({ step: 'pipeline.stage', stage, status: runningStatus }, 'pipeline.stage started');

      try {
        const handler = this.handlers[stage];
        if (handler) {
          await handler(ctx);
        } else {
          log.info({ step: 'pipeline.stage', stage }, 'pipeline.stage has no handler');
        }

        const completedAt = new Date();
        await this.stageRepo.update(stageRecord.id, {
          status: 'COMPLETED',
          progress: 100,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        });

        log.info(
          { step: 'pipeline.stage', stage, durationMs: Date.now() - stageStartedMs },
          'pipeline.stage completed',
        );

        const afterStatus = AFTER_STAGE_STATUS[stage];
        if (afterStatus === 'COMPLETED') {
          await this.jobRepo.update(ctx.jobId, {
            status: 'COMPLETED',
            progress: 100,
            currentStage: 'completed',
            completedAt,
          });
          log.info(
            { step: 'pipeline.job', status: 'COMPLETED', recipeId: ctx.recipeId ?? null },
            'pipeline.job completed',
          );
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

        log.error(
          {
            step: 'pipeline.stage',
            stage,
            durationMs: Date.now() - stageStartedMs,
            errorCode: serialized.code ?? null,
            errorMessage: serialized.message,
            errorCause: serialized.cause ?? null,
            err: error,
          },
          'pipeline.stage failed',
        );

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
  log?: AppLogger;
}

export function createDefaultStageHandlers(
  deps: StageHandlerDeps,
): Partial<Record<PipelineStage, StageHandler>> {
  const evidenceBuilder = new EvidenceBuilder({
    mediaMaxChars: deps.config.extraction.evidenceMediaMaxChars,
    transcriptMaxChars: deps.config.extraction.evidenceTranscriptMaxChars,
  });
  const recipeNormalizer = new RecipeNormalizer();
  const confidenceCalculator = new ConfidenceCalculator();
  const recipeValidator = new RecipeValidator();
  const log = deps.log ?? silentLogger();

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
      log.child({ jobId: ctx.jobId }).info(
        { step: 'content.acquire', ...summarizeAcquiredContent(ctx.acquiredContent) },
        'content.acquire summary',
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
        metadata.thumbnailUrl =
          options.selectedThumbnailUrl ?? ctx.acquiredContent.thumbnailUrl ?? null;
      } else {
        delete metadata.thumbnailUrl;
      }

      // Once a recipe exists, its source metadata is the immutable import provenance.
      // Force-refresh may re-run extraction for diagnostics, but never rewrites that original.
      const importedRecipe = await deps.recipeRepo.findBySourceId(source.id);
      if (!importedRecipe) {
        await deps.sourceRepo.updateMetadata(source.id, metadata as Prisma.InputJsonValue);
      }

      await maybeDelay(deps.config.extraction.fakePipelineDelayMs);
    },

    ...createMediaStageHandlers(deps),

    EXTRACTING_RECIPE: async (ctx): Promise<void> => {
      const job = await deps.jobRepo.findById(ctx.jobId);
      if (!job) {
        throw new ExtractionFailedError({ message: 'Job not found during extraction' });
      }

      const jobLog = log.child({ jobId: ctx.jobId });

      ctx.evidence = evidenceBuilder.build({
        ...(ctx.acquiredContent ? { acquiredContent: ctx.acquiredContent } : {}),
        ...(ctx.transcript ? { transcript: ctx.transcript } : {}),
        ...(ctx.ocrResults ? { ocrResults: ctx.ocrResults } : {}),
        ...(ctx.visionAnalyses ? { visionAnalyses: ctx.visionAnalyses } : {}),
      });

      const evidence = ctx.evidence;
      jobLog.info(
        { step: 'evidence.build', ...summarizeEvidence(evidence) },
        'evidence.build completed',
      );
      if (evidence.length === 0) {
        jobLog.error(
          {
            step: 'evidence.build',
            hasContent: Boolean(ctx.acquiredContent),
            hasTranscript: Boolean(ctx.transcript),
            ocrResults: ctx.ocrResults?.length ?? 0,
            visionAnalyses: ctx.visionAnalyses?.length ?? 0,
          },
          'evidence.build produced nothing to extract from',
        );
        throw new ExtractionFailedError({
          message: 'No evidence available to extract a recipe',
        });
      }

      await logStep(jobLog, 'evidence.persist', { items: evidence.length }, () =>
        deps.evidenceRepo.createMany(
          evidence.map((item) => ({
            jobId: ctx.jobId,
            evidenceType: item.evidenceType,
            value: item.value,
            source: item.source,
            timestampSeconds: item.timestampSeconds ?? null,
            confidence: item.confidence,
            metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
          })),
        ),
      );

      const options = parseJobOptions(job.options);
      ctx.options = options;

      const usageTracker = new AIUsageTracker(deps.aiUsageRepo, DEFAULT_PRICING);
      const ai = createAIProviders(deps.config, usageTracker, ctx.jobId, jobLog);

      const classifier = createRecipeClassifier(ai.llm, {
        useLlm: Boolean(deps.config.ai.openaiApiKey),
        log: jobLog,
      });
      const classification = await logStep(
        jobLog,
        'ai.classify-recipe',
        { evidenceCount: evidence.length },
        () =>
          classifier.classify({
            evidence,
            ...(ctx.acquiredContent?.structuredRecipe
              ? { structuredRecipe: ctx.acquiredContent.structuredRecipe }
              : {}),
            ...(ctx.acquiredContent ? { sourceType: ctx.acquiredContent.sourceType } : {}),
            url: ctx.sourceUrl,
          }),
      );
      jobLog.info(
        {
          step: 'ai.classify-recipe',
          isFoodRecipe: classification.isFoodRecipe,
          confidence: classification.confidence,
          category: classification.category,
          method: classification.method,
          reason: classification.reason,
        },
        'ai.classify-recipe result',
      );
      assertFoodRecipe(classification);

      const extractor = new RecipeExtractor(ai.llm);

      const {
        recipe: extracted,
        promptVersion,
        rawExtraction,
      } = await logStep(
        jobLog,
        'ai.extract-recipe',
        { evidenceCount: evidence.length },
        () =>
          extractor.extract({
            evidence,
            outputLanguage: ctx.outputLanguage,
          }),
      );
      jobLog.info(
        {
          step: 'ai.extract-recipe',
          promptVersion,
          title: extracted.title,
          ingredients: extracted.ingredients.length,
          steps: extracted.steps.length,
          servings: extracted.servings ?? null,
          totalTimeMinutes: extracted.totalTimeMinutes ?? null,
          calories: extracted.calories ?? null,
          nutritionSource: extracted.nutritionSource ?? null,
          sourceLanguage: extracted.sourceLanguage,
        },
        'ai.extract-recipe result',
      );

      const normalized = recipeNormalizer.normalize(extracted, ctx.outputLanguage);
      jobLog.info(
        {
          step: 'recipe.normalize',
          ingredients: normalized.ingredients.length,
          steps: normalized.steps.length,
          ingredientsWithoutQuantity: normalized.ingredients.filter((i) => i.quantity === null).length,
          ingredientsWithoutMetric: normalized.ingredients.filter((i) => !i.metricUnit).length,
          ingredientsWithoutImperial: normalized.ingredients.filter((i) => !i.imperialUnit).length,
        },
        'recipe.normalize completed',
      );
      try {
        assertExtractedRecipeHasContent(normalized);
      } catch (error: unknown) {
        jobLog.warn(
          { step: 'recipe.content-check', ingredients: normalized.ingredients.length, steps: normalized.steps.length },
          'recipe.content-check rejected an empty extraction',
        );
        throw error;
      }
      const validation = recipeValidator.validate(normalized);
      normalized.warnings = validation.warnings as unknown as Prisma.InputJsonValue;
      normalized.confidence = confidenceCalculator.calculate(normalized);
      jobLog.info(
        {
          step: 'recipe.validate',
          valid: validation.valid,
          warningCodes: validation.warnings.map((w) => w.code),
          confidence: normalized.confidence,
        },
        'recipe.validate completed',
      );

      const originalPostText =
        ctx.acquiredContent?.description?.trim() || ctx.acquiredContent?.caption?.trim() || null;
      const extractedDescription = normalized.description?.trim() || null;
      const copiedSourceCaption =
        originalPostText !== null &&
        extractedDescription !== null &&
        extractedDescription.localeCompare(originalPostText, undefined, {
          sensitivity: 'accent',
        }) === 0 &&
        primaryLanguage(ctx.outputLanguage) !== primaryLanguage(normalized.sourceLanguage);

      const recipeFields = {
        title: normalized.title,
        description: copiedSourceCaption ? null : extractedDescription,
        servings: normalized.servings,
        prepTimeMinutes: normalized.prepTimeMinutes,
        cookTimeMinutes: normalized.cookTimeMinutes,
        totalTimeMinutes: normalized.totalTimeMinutes,
        difficulty: normalized.difficulty ?? null,
        calories: normalized.calories,
        nutritionSource: normalized.nutritionSource ?? null,
        cuisine: normalized.cuisine,
        nutrition: normalized.nutrition,
        sourceLanguage: normalized.sourceLanguage,
        confidence: normalized.confidence,
        warnings: normalized.warnings,
        promptVersion,
        rawExtraction: rawExtraction as unknown as Prisma.InputJsonValue,
        categorySlugs: normalized.categorySlugs ?? ['dinner'],
        reviewState:
          validation.valid && validation.warnings.length === 0 && normalized.confidence >= 0.8
            ? ('READY' as const)
            : ('NEEDS_REVIEW' as const),
        ingredients: normalized.ingredients.map((ing) => ({
          name: ing.name,
          canonicalName: ing.canonicalName,
          quantity: ing.quantity,
          unit: ing.unit,
          metricQuantity: ing.metricQuantity ?? null,
          metricUnit: ing.metricUnit ?? null,
          imperialQuantity: ing.imperialQuantity ?? null,
          imperialUnit: ing.imperialUnit ?? null,
          preparation: ing.preparation,
          optional: ing.optional,
          emoji: ing.emoji ?? '🥣',
          colorToken: ing.colorToken ?? 'peach',
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
          temperatureCelsius: step.temperatureCelsius ?? null,
          temperatureFahrenheit: step.temperatureFahrenheit ?? null,
          ingredientRefs: step.ingredientRefs ?? [],
          stage: step.stage,
          confidence: step.confidence,
          provenance: step.provenance,
          warnings: step.warnings,
        })),
      };

      const recipe = await logStep(
        jobLog,
        'recipe.persist',
        { recipeSourceId: job.recipeSourceId, reviewState: recipeFields.reviewState },
        async () => {
          const existing = await deps.recipeRepo.findBySourceId(job.recipeSourceId);
          if (existing) {
            jobLog.info(
              { step: 'recipe.persist', recipeId: existing.id, reused: true },
              'recipe.persist reusing the recipe already imported from this source',
            );
            await deps.jobRepo.clearRecipeIdExcept(existing.id, ctx.jobId);
            return existing;
          }
          return deps.recipeRepo.create({
            recipeSourceId: job.recipeSourceId,
            ...recipeFields,
          });
        },
      );

      ctx.recipeId = recipe.id;
      await deps.jobRepo.update(ctx.jobId, { recipeId: recipe.id });
      jobLog.info({ step: 'recipe.persist', recipeId: recipe.id }, 'recipe linked to job');
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

      const normalized = recipeNormalizer.normalize(
        {
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
        },
        ctx.outputLanguage,
      );

      const validation = recipeValidator.validate(normalized);
      log.child({ jobId: ctx.jobId }).info(
        {
          step: 'recipe.final-validate',
          recipeId,
          valid: validation.valid,
          warningCodes: validation.warnings.map((w) => w.code),
          ingredients: recipe.ingredients.length,
          steps: recipe.steps.length,
        },
        'recipe.final-validate completed',
      );
    },
  };
}

function summarizeAcquiredContent(content: AcquiredContent): Record<string, unknown> {
  return {
    sourceType: content.sourceType,
    title: content.title ?? null,
    author: content.author ?? null,
    language: content.language ?? null,
    captionChars: content.caption?.length ?? 0,
    descriptionChars: content.description?.length ?? 0,
    pageTextChars: content.pageText?.length ?? 0,
    images: content.images.length,
    slides: content.images.filter((i) => i.slideIndex !== undefined).length,
    videos: content.videos?.length ?? (content.videoLocalPath ? 1 : 0),
    captions: content.captions ? content.captions.kind : null,
    structuredRecipe: content.structuredRecipe
      ? {
          source: content.structuredRecipe.source,
          name: content.structuredRecipe.name ?? null,
          ingredients: content.structuredRecipe.ingredients.length,
          instructionSteps: content.structuredRecipe.instructions.reduce(
            (sum, section) => sum + section.steps.length,
            0,
          ),
        }
      : null,
    hasThumbnail: Boolean(content.thumbnailUrl),
  };
}

function summarizeEvidence(evidence: EvidenceItem[]): Record<string, unknown> {
  const byType: Record<string, number> = {};
  let totalChars = 0;
  for (const item of evidence) {
    byType[item.evidenceType] = (byType[item.evidenceType] ?? 0) + 1;
    totalChars += item.value.length;
  }
  return { items: evidence.length, byType, totalChars };
}

function maybeDelay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STDERR_LIMIT = 500;

/** Flatten an error + nested causes/stderr into the JSON stored on job/stage rows. */
export function serializeStageError(error: unknown): {
  message: string;
  code?: string;
  cause?: string;
} {
  const message = error instanceof Error ? error.message : 'Stage failed';
  const code = isAppError(error) ? error.code : undefined;
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

  return {
    message,
    ...(code ? { code } : {}),
    ...(parts.length > 0 ? { cause: parts.join(' | ') } : {}),
  };
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
