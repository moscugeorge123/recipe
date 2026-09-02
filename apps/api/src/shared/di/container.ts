import { config, type AppConfig } from '../../config/env.js';
import { PrismaAIUsageRepository } from '../../infrastructure/database/repositories/ai-usage.repository.js';
import { PrismaExtractionEvidenceRepository } from '../../infrastructure/database/repositories/extraction-evidence.repository.js';
import { PrismaExtractionJobRepository } from '../../infrastructure/database/repositories/extraction-job.repository.js';
import { PrismaExtractionStageRepository } from '../../infrastructure/database/repositories/extraction-stage.repository.js';
import { PrismaMediaAssetRepository } from '../../infrastructure/database/repositories/media-asset.repository.js';
import { PrismaOCRRepository } from '../../infrastructure/database/repositories/ocr.repository.js';
import { PrismaCookSessionRepository } from '../../infrastructure/database/repositories/cook-session.repository.js';
import { PrismaProfileBootstrapRepository } from '../../infrastructure/database/repositories/profile-bootstrap.repository.js';
import { PrismaRecipeRepository } from '../../infrastructure/database/repositories/recipe.repository.js';
import { PrismaRecipeSourceRepository } from '../../infrastructure/database/repositories/recipe-source.repository.js';
import { PrismaTranscriptRepository } from '../../infrastructure/database/repositories/transcript.repository.js';
import { PrismaVisionRepository } from '../../infrastructure/database/repositories/vision.repository.js';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import pino from 'pino';

import {
  buildLoggerOptions,
  silentLogger,
  type AppLogger,
} from '../../infrastructure/logging/logger.js';
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
import { CategoryService } from '../../modules/categories/application/category-service.js';
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
import { ProfileBootstrapService } from '../../modules/profiles/application/profile-bootstrap-service.js';
import {
  DEFAULT_PROFILE_ID,
  ImplicitProfileResolver,
  type ProfileResolver,
} from '../../modules/profiles/domain/profile.js';
import { RecipeService } from '../../modules/recipes/application/recipe-service.js';
import { MediaProcessingService } from '../../modules/media/application/media-processing.service.js';
import { FfmpegMediaProcessor } from '../../modules/media/ffmpeg/ffmpeg-media-processor.js';
import type { IMediaAssetRepository } from '../../modules/media/repository/media-asset.repository.js';
import type { IRecipeRepository } from '../../modules/recipes/repository/recipe.repository.js';
import type { IRecipeSourceRepository } from '../../modules/recipes/repository/recipe-source.repository.js';
import { PrismaNutritionRepository } from '../../infrastructure/database/repositories/nutrition.repository.js';
import type { INutritionRepository } from '../../infrastructure/database/repositories/nutrition.repository.js';
import { PrismaCollectionRepository } from '../../infrastructure/database/repositories/collection.repository.js';
import { PrismaPantryRepository } from '../../infrastructure/database/repositories/pantry.repository.js';
import { CollectionService } from '../../modules/collections/application/collection-service.js';
import type { ICollectionRepository } from '../../modules/collections/repository/collection.repository.js';
import { NutritionCalculator } from '../../modules/nutrition/application/nutrition-calculator.js';
import {
  NUTRITION_JOB_NAME,
  NutritionService,
} from '../../modules/nutrition/application/nutrition-service.js';
import { createNutritionProvider } from '../../modules/nutrition/providers/create-nutrition-provider.js';
import type { NutritionProvider } from '../../modules/nutrition/domain/types.js';
import { OpenAIProvider } from '../../infrastructure/ai/llm/openai-provider.js';
import type { LLMProvider } from '../../infrastructure/ai/llm/llm-provider.js';
import { AIUsageTracker } from '../../infrastructure/ai/usage/ai-usage-tracker.js';
import { DEFAULT_PRICING } from '../../infrastructure/ai/usage/pricing.js';
import {
  MemoryClassificationCache,
  RedisBackedClassificationCache,
  type ClassificationCache,
} from '../../modules/pantry/application/classification-cache.js';
import { IngredientOrganizer } from '../../modules/pantry/application/ingredient-organizer.js';
import { PantryService } from '../../modules/pantry/application/pantry-service.js';
import type { IPantryRepository } from '../../modules/pantry/repository/pantry.repository.js';

/**
 * Lightweight composition root. Grows as modules are wired in; no DI framework required.
 */
export interface AppContainer {
  config: AppConfig;
  log: AppLogger;
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
    profileBootstrap: PrismaProfileBootstrapRepository;
    nutrition: INutritionRepository;
    pantry: IPantryRepository;
    collection: ICollectionRepository;
  };
  contentRegistry: ContentProviderRegistry;
  contentAcquisition: ContentAcquisitionService;
  linkPreviewService: LinkPreviewService;
  mediaProcessing: MediaProcessingService;
  extractionJobService: ExtractionJobService;
  recipeService: RecipeService;
  categoryService: CategoryService;
  cookSessionService: CookSessionService;
  profileBootstrap: ProfileBootstrapService;
  profileResolver: ProfileResolver;
  pipeline: RecipeExtractionPipeline;
  nutritionService: NutritionService;
  pantryService: PantryService;
  collectionService: CollectionService;
  createQueue(): QueueProvider;
  createNutritionQueue(): QueueProvider;
}

export interface CreateContainerOptions {
  storage?: StorageProvider;
  queue?: QueueProvider;
  nutritionQueue?: QueueProvider;
  nutritionProvider?: NutritionProvider;
  enableMediaProcessing?: boolean;
  logger?: AppLogger;
  profileResolver?: ProfileResolver;
  pantryLlm?: LLMProvider | null;
  pantryCache?: ClassificationCache;
}

export function createContentRegistry(appConfig: AppConfig): ContentProviderRegistry {
  const registry = new DefaultContentProviderRegistry();

  registry.register(
    new InstagramContentProvider(new HttpApifyClient(appConfig.providers.apifyApiToken ?? '')),
  );
  registry.register(new YouTubeContentProvider(new YtDlpClient(appConfig.providers.ytdlpPath)));
  registry.register(new FacebookContentProvider());
  registry.register(new TikTokContentProvider());
  registry.register(new FakeContentProvider());
  registry.register(new GenericWebContentProvider());

  return registry;
}

export function createContainer(options: CreateContainerOptions = {}): AppContainer {
  const appConfig = config;
  const log =
    options.logger ?? (appConfig.isTest ? silentLogger() : pino(buildLoggerOptions(appConfig)));
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
    profileBootstrap: new PrismaProfileBootstrapRepository(prisma),
    nutrition: new PrismaNutritionRepository(prisma),
    pantry: new PrismaPantryRepository(prisma),
    collection: new PrismaCollectionRepository(prisma),
  };

  const contentRegistry = createContentRegistry(appConfig);
  const contentAcquisition = new ContentAcquisitionService(contentRegistry, log);
  const linkPreviewService = createLinkPreviewService(appConfig, { log });

  const mediaProcessing = new MediaProcessingService(
    new FfmpegMediaProcessor(),
    storage,
    repositories.mediaAsset,
    appConfig,
    log,
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
    log,
  });

  const orchestrator = new StageOrchestrator(
    repositories.extractionJob,
    repositories.extractionStage,
    stageHandlers,
    log,
  );

  const pipeline = new RecipeExtractionPipeline(
    repositories.extractionJob,
    repositories.recipeSource,
    orchestrator,
    log,
    async (recipeId) => {
      await nutritionService.requestForRecipe(recipeId, DEFAULT_PROFILE_ID);
    },
  );

  let queueInstance: QueueProvider | undefined = options.queue;
  let nutritionQueueInstance: QueueProvider | undefined = options.nutritionQueue;

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
      log,
    );

    return queueInstance;
  };

  const createNutritionQueue = (): QueueProvider => {
    if (nutritionQueueInstance) {
      return nutritionQueueInstance;
    }

    nutritionQueueInstance = new BullMQQueueProvider(
      QueueName.NUTRITION_JOBS,
      getRedisClient(),
      appConfig.nutrition.queueConcurrency,
      appConfig.nutrition.backoffMs,
      appConfig.nutrition.maxRetries,
      log,
    );

    return nutritionQueueInstance;
  };

  const queue =
    queueInstance ??
    (options.queue === undefined ? new LazyQueueProvider(createQueue) : createQueue());
  const nutritionQueue =
    nutritionQueueInstance ??
    (options.nutritionQueue === undefined
      ? new LazyQueueProvider(createNutritionQueue)
      : createNutritionQueue());

  const nutritionProvider = options.nutritionProvider
    ? createNutritionProvider(appConfig, options.nutritionProvider)
    : createNutritionProvider(appConfig);
  const nutritionCalculator = new NutritionCalculator(nutritionProvider, repositories.nutrition);
  const nutritionService = new NutritionService(
    repositories.recipe,
    repositories.nutrition,
    nutritionCalculator,
    nutritionQueue,
    log,
  );

  const extractionJobService = new ExtractionJobService(
    repositories.extractionJob,
    repositories.recipeSource,
    contentRegistry,
    queue,
    log,
  );

  const recipeService = new RecipeService(repositories.recipe, nutritionService);
  const categoryService = new CategoryService(prisma);
  const cookSessionService = new CookSessionService(repositories.cookSession, repositories.recipe);
  const profileBootstrap = new ProfileBootstrapService(repositories.profileBootstrap);
  const profileResolver = options.profileResolver ?? new ImplicitProfileResolver();

  const pantryCache =
    options.pantryCache ??
    (appConfig.isTest
      ? new MemoryClassificationCache()
      : new RedisBackedClassificationCache(getRedisClient()));
  const pantryLlm =
    options.pantryLlm !== undefined
      ? options.pantryLlm
      : appConfig.ai.openaiApiKey
        ? new OpenAIProvider(appConfig, null)
        : null;
  const pantryUsage = new AIUsageTracker(repositories.aiUsage, DEFAULT_PRICING);
  const pantryService = new PantryService(
    repositories.pantry,
    new IngredientOrganizer(appConfig, pantryCache, pantryLlm, pantryUsage),
  );
  const collectionService = new CollectionService(repositories.collection);

  return {
    config: appConfig,
    log,
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
    categoryService,
    cookSessionService,
    profileBootstrap,
    profileResolver,
    pipeline,
    nutritionService,
    pantryService,
    collectionService,
    createQueue,
    createNutritionQueue,
  };
}

/** Test container with in-memory queues for synchronous pipeline execution. */
export function createTestContainer(options: CreateContainerOptions = {}): AppContainer {
  const queue = options.queue ?? new InMemoryQueueProvider();
  const nutritionQueue = options.nutritionQueue ?? new InMemoryQueueProvider();
  const container = createContainer({ ...options, queue, nutritionQueue });

  if (queue instanceof InMemoryQueueProvider) {
    queue.registerProcessor(EXTRACTION_JOB_NAME, async (payload) => {
      await container.pipeline.execute(payload.jobId);
    });
  }
  if (nutritionQueue instanceof InMemoryQueueProvider) {
    nutritionQueue.registerProcessor(NUTRITION_JOB_NAME, async (payload) => {
      await container.nutritionService.processSnapshot(payload.jobId);
    });
  }

  return container;
}

export type { BullMQQueueProviderType };
