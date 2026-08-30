import { config, type AppConfig } from '../../config/env.js';
import { PrismaAIUsageRepository } from '../../infrastructure/database/repositories/ai-usage.repository.js';
import { PrismaExtractionEvidenceRepository } from '../../infrastructure/database/repositories/extraction-evidence.repository.js';
import { PrismaExtractionJobRepository } from '../../infrastructure/database/repositories/extraction-job.repository.js';
import { PrismaExtractionStageRepository } from '../../infrastructure/database/repositories/extraction-stage.repository.js';
import { PrismaMediaAssetRepository } from '../../infrastructure/database/repositories/media-asset.repository.js';
import { PrismaOCRRepository } from '../../infrastructure/database/repositories/ocr.repository.js';
import { PrismaCookSessionRepository } from '../../infrastructure/database/repositories/cook-session.repository.js';
import { PrismaRecipeRepository } from '../../infrastructure/database/repositories/recipe.repository.js';
import { PrismaRecipeSourceRepository } from '../../infrastructure/database/repositories/recipe-source.repository.js';
import { PrismaTranscriptRepository } from '../../infrastructure/database/repositories/transcript.repository.js';
import { PrismaVisionRepository } from '../../infrastructure/database/repositories/vision.repository.js';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import {
  BullMQQueueProvider,
  InMemoryQueueProvider,
  LazyQueueProvider,
  type BullMQQueueProvider as BullMQQueueProviderType,
} from '../../infrastructure/queues/bullmq/bullmq-queue-provider.js';
import { QueueName } from '../../infrastructure/queues/names.js';
import type { QueueProvider } from '../../infrastructure/queues/bullmq/queue-provider.js';
import { getRedisClient } from '../../infrastructure/redis/client.js';
import { createStorageProvider } from '../../infrastructure/storage/create-storage-provider.js';
import type { StorageProvider } from '../../infrastructure/storage/storage-provider.js';
import { ContentAcquisitionService } from '../../modules/content/application/content-acquisition.service.js';
import { FakeContentProvider } from '../../modules/content/providers/fake/fake-content-provider.js';
import { FacebookContentProvider } from '../../modules/content/providers/facebook/facebook-content-provider.js';
import { GenericWebContentProvider } from '../../modules/content/providers/generic/generic-web-content-provider.js';
import { HttpApifyClient } from '../../modules/content/providers/instagram/apify-client.js';
import { InstagramContentProvider } from '../../modules/content/providers/instagram/instagram-content-provider.js';
import { TikTokContentProvider } from '../../modules/content/providers/tiktok/tiktok-content-provider.js';
import { YouTubeContentProvider } from '../../modules/content/providers/youtube/youtube-content-provider.js';
import { YtDlpClient } from '../../modules/content/providers/youtube/ytdlp-client.js';
import {
  createLinkPreviewService,
  type LinkPreviewService,
} from '../../modules/content/preview/link-preview.service.js';
import { DefaultContentProviderRegistry } from '../../modules/content/registry/content-provider-registry.js';
import type { ContentProviderRegistry } from '../../modules/content/domain/types.js';
import {
  createDefaultStageHandlers,
  StageOrchestrator,
} from '../../modules/extraction/application/stage-orchestrator.js';
import { RecipeExtractionPipeline } from '../../modules/extraction/application/recipe-extraction-pipeline.js';
import {
  ExtractionJobService,
  EXTRACTION_JOB_NAME,
} from '../../modules/jobs/application/extraction-job.service.js';
import type { IExtractionJobRepository } from '../../modules/jobs/repository/extraction-job.repository.js';
import type { IExtractionStageRepository } from '../../modules/jobs/repository/extraction-stage.repository.js';
import { CookSessionService } from '../../modules/cook-sessions/application/cook-session-service.js';
import type { ICookSessionRepository } from '../../modules/cook-sessions/repository/cook-session.repository.js';
import { RecipeService } from '../../modules/recipes/application/recipe-service.js';
import { MediaProcessingService } from '../../modules/media/application/media-processing.service.js';
import { FfmpegMediaProcessor } from '../../modules/media/ffmpeg/ffmpeg-media-processor.js';
import type { IMediaAssetRepository } from '../../modules/media/repository/media-asset.repository.js';
import type { IRecipeRepository } from '../../modules/recipes/repository/recipe.repository.js';
import type { IRecipeSourceRepository } from '../../modules/recipes/repository/recipe-source.repository.js';

/**
 * Lightweight composition root. Grows as modules are wired in; no DI framework required.
 */
export interface AppContainer {
  config: AppConfig;
  prisma: typeof prisma;
  redis: ReturnType<typeof getRedisClient>;
  storage: StorageProvider;
  repositories: {
    extractionJob: IExtractionJobRepository;
    extractionStage: IExtractionStageRepository;
    recipe: IRecipeRepository;
    recipeSource: IRecipeSourceRepository;
    cookSession: ICookSessionRepository;
    mediaAsset: IMediaAssetRepository;
    evidence: PrismaExtractionEvidenceRepository;
    transcript: PrismaTranscriptRepository;
    ocr: PrismaOCRRepository;
    vision: PrismaVisionRepository;
    aiUsage: PrismaAIUsageRepository;
  };
  contentRegistry: ContentProviderRegistry;
  contentAcquisition: ContentAcquisitionService;
  linkPreviewService: LinkPreviewService;
  mediaProcessing: MediaProcessingService;
  extractionJobService: ExtractionJobService;
  recipeService: RecipeService;
  cookSessionService: CookSessionService;
  pipeline: RecipeExtractionPipeline;
  createQueue(): QueueProvider;
}

export interface CreateContainerOptions {
  storage?: StorageProvider;
  queue?: QueueProvider;
  enableMediaProcessing?: boolean;
}

export function createContentRegistry(appConfig: AppConfig): ContentProviderRegistry {
  const registry = new DefaultContentProviderRegistry();

  registry.register(new InstagramContentProvider(new HttpApifyClient(appConfig.providers.apifyApiToken ?? '')));
  registry.register(new YouTubeContentProvider(new YtDlpClient(appConfig.providers.ytdlpPath)));
  registry.register(new FacebookContentProvider());
  registry.register(new TikTokContentProvider());
  registry.register(new FakeContentProvider());
  registry.register(new GenericWebContentProvider());

  return registry;
}

export function createContainer(options: CreateContainerOptions = {}): AppContainer {
  const appConfig = config;
  const storage = options.storage ?? createStorageProvider(appConfig);

  const repositories = {
    extractionJob: new PrismaExtractionJobRepository(prisma),
    extractionStage: new PrismaExtractionStageRepository(prisma),
    recipe: new PrismaRecipeRepository(prisma),
    recipeSource: new PrismaRecipeSourceRepository(prisma),
    cookSession: new PrismaCookSessionRepository(prisma),
    mediaAsset: new PrismaMediaAssetRepository(prisma),
    evidence: new PrismaExtractionEvidenceRepository(prisma),
    transcript: new PrismaTranscriptRepository(prisma),
    ocr: new PrismaOCRRepository(prisma),
    vision: new PrismaVisionRepository(prisma),
    aiUsage: new PrismaAIUsageRepository(prisma),
  };

  const contentRegistry = createContentRegistry(appConfig);
  const contentAcquisition = new ContentAcquisitionService(contentRegistry);
  const linkPreviewService = createLinkPreviewService(appConfig);

  const mediaProcessing = new MediaProcessingService(
    new FfmpegMediaProcessor(),
    storage,
    repositories.mediaAsset,
    appConfig,
  );

  const stageHandlers = createDefaultStageHandlers({
    contentAcquisition,
    mediaProcessing: options.enableMediaProcessing === false ? null : mediaProcessing,
    recipeRepo: repositories.recipe,
    jobRepo: repositories.extractionJob,
    sourceRepo: repositories.recipeSource,
    mediaAssetRepo: repositories.mediaAsset,
    evidenceRepo: repositories.evidence,
    transcriptRepo: repositories.transcript,
    ocrRepo: repositories.ocr,
    visionRepo: repositories.vision,
    aiUsageRepo: repositories.aiUsage,
    storage,
    config: appConfig,
  });

  const orchestrator = new StageOrchestrator(
    repositories.extractionJob,
    repositories.extractionStage,
    stageHandlers,
  );

  const pipeline = new RecipeExtractionPipeline(
    repositories.extractionJob,
    repositories.recipeSource,
    orchestrator,
  );

  let queueInstance: QueueProvider | undefined = options.queue;

  const createQueue = (): QueueProvider => {
    if (queueInstance) {
      return queueInstance;
    }

    queueInstance = new BullMQQueueProvider(
      QueueName.EXTRACTION_JOBS,
      getRedisClient(),
      appConfig.extraction.queueConcurrency,
      appConfig.extraction.backoffMs,
      appConfig.extraction.maxRetries,
    );

    return queueInstance;
  };

  const queue =
    queueInstance ??
    (options.queue === undefined
      ? new LazyQueueProvider(createQueue)
      : createQueue());

  const extractionJobService = new ExtractionJobService(
    repositories.extractionJob,
    repositories.recipeSource,
    contentRegistry,
    queue,
  );

  const recipeService = new RecipeService(repositories.recipe, repositories.recipeSource);
  const cookSessionService = new CookSessionService(repositories.cookSession, repositories.recipe);

  return {
    config: appConfig,
    prisma,
    redis: getRedisClient(),
    storage,
    repositories,
    contentRegistry,
    contentAcquisition,
    linkPreviewService,
    mediaProcessing,
    extractionJobService,
    recipeService,
    cookSessionService,
    pipeline,
    createQueue,
  };
}

/** Test container with in-memory queue for synchronous pipeline execution. */
export function createTestContainer(options: CreateContainerOptions = {}): AppContainer {
  const queue = options.queue ?? new InMemoryQueueProvider();
  const container = createContainer({ ...options, queue });

  if (queue instanceof InMemoryQueueProvider) {
    queue.registerProcessor(EXTRACTION_JOB_NAME, async (payload) => {
      await container.pipeline.execute(payload.jobId);
    });
  }

  return container;
}

export type { BullMQQueueProviderType };
