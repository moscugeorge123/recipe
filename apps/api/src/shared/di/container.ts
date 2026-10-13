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
import {
  PrismaProviderUsageRepository,
  type CreateProviderUsageInput,
} from '../../infrastructure/database/repositories/provider-usage.repository.js';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import pino from 'pino';

import {
  buildLoggerOptions,
  silentLogger,
  type AppLogger,
} from '../../infrastructure/logging/logger.js';
import { FileLogReader } from '../../infrastructure/logging/log-reader.js';
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
import type { ProviderChargeRecorder } from '../../modules/content/application/content-acquisition.service.js';
import { DashboardService } from '../../modules/dashboard/application/dashboard.service.js';
import { FakeContentProvider } from '../../modules/content/providers/fake/fake-content-provider.js';
import { FacebookContentProvider } from '../../modules/content/providers/facebook/facebook-content-provider.js';
import { ApifyPageFetcher } from '../../modules/content/providers/generic/apify-page-fetcher.js';
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
  ImplicitProfileResolver,
  type ProfileResolver,
} from '../../modules/profiles/domain/profile.js';
import { RecipeService } from '../../modules/recipes/application/recipe-service.js';
import { MediaProcessingService } from '../../modules/media/application/media-processing.service.js';
import { FfmpegMediaProcessor } from '../../modules/media/ffmpeg/ffmpeg-media-processor.js';
import type { IMediaAssetRepository } from '../../modules/media/repository/media-asset.repository.js';
import type { IRecipeRepository } from '../../modules/recipes/repository/recipe.repository.js';
import type { IRecipeSourceRepository } from '../../modules/recipes/repository/recipe-source.repository.js';
import { PrismaCollectionRepository } from '../../infrastructure/database/repositories/collection.repository.js';
import { PrismaPantryRepository } from '../../infrastructure/database/repositories/pantry.repository.js';
import { PrismaMealPlanRepository } from '../../infrastructure/database/repositories/meal-plan.repository.js';
import { PrismaShoppingListRepository } from '../../infrastructure/database/repositories/shopping-list.repository.js';
import { CollectionService } from '../../modules/collections/application/collection-service.js';
import type { ICollectionRepository } from '../../modules/collections/repository/collection.repository.js';
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
import { RecipeTranslationService } from '../../modules/recipes/application/recipe-translation-service.js';
import { RecipeTranslator } from '../../modules/recipes/application/recipe-translator.js';
import { RecipeAssistant } from '../../modules/recipes/application/recipe-assistant.js';
import { PantryService } from '../../modules/pantry/application/pantry-service.js';
import type { IPantryRepository } from '../../modules/pantry/repository/pantry.repository.js';
import { MealPlanService } from '../../modules/meal-plan/application/meal-plan-service.js';
import type { IMealPlanRepository } from '../../modules/meal-plan/repository/meal-plan.repository.js';
import { ShoppingListService } from '../../modules/shopping-list/application/shopping-list-service.js';
import type { IShoppingListRepository } from '../../modules/shopping-list/repository/shopping-list.repository.js';

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
    pantry: IPantryRepository;
    shoppingList: IShoppingListRepository;
    mealPlan: IMealPlanRepository;
    collection: ICollectionRepository;
    providerUsage: PrismaProviderUsageRepository;
  };
  contentRegistry: ContentProviderRegistry;
  contentAcquisition: ContentAcquisitionService;
  linkPreviewService: LinkPreviewService;
  mediaProcessing: MediaProcessingService;
  extractionJobService: ExtractionJobService;
  recipeService: RecipeService;
  recipeAssistant: RecipeAssistant;
  categoryService: CategoryService;
  cookSessionService: CookSessionService;
  profileBootstrap: ProfileBootstrapService;
  profileResolver: ProfileResolver;
  dashboardService: DashboardService;
  pipeline: RecipeExtractionPipeline;
  pantryService: PantryService;
  shoppingListService: ShoppingListService;
  mealPlanService: MealPlanService;
  collectionService: CollectionService;
  createQueue(): QueueProvider;
}

export interface CreateContainerOptions {
  storage?: StorageProvider;
  queue?: QueueProvider;
  enableMediaProcessing?: boolean;
  logger?: AppLogger;
  profileResolver?: ProfileResolver;
  pantryLlm?: LLMProvider | null;
  assistLlm?: LLMProvider | null;
  translationLlm?: LLMProvider | null;
  pantryCache?: ClassificationCache;
}

export function createContentRegistry(appConfig: AppConfig): ContentProviderRegistry {
  const registry = new DefaultContentProviderRegistry();

  registry.register(
    new InstagramContentProvider(new HttpApifyClient(appConfig.providers.apifyApiToken ?? ''), {
      maxVideos: appConfig.extraction.maxPostVideos,
      maxDownloadBytes: appConfig.extraction.maxMediaDownloadBytes,
    }),
  );
  registry.register(new YouTubeContentProvider(new YtDlpClient(appConfig.providers.ytdlpPath)));
  registry.register(new FacebookContentProvider());
  registry.register(new TikTokContentProvider());
  registry.register(new FakeContentProvider());
  const { apifyApiToken, webBlockedFallback } = appConfig.providers;
  registry.register(
    new GenericWebContentProvider(
      apifyApiToken && webBlockedFallback && !appConfig.isTest
        ? { blockedPageFetcher: new ApifyPageFetcher(apifyApiToken) }
        : {},
    ),
  );

  return registry;
}

function withChargeRecording(
  repository: PrismaProviderUsageRepository,
): PrismaProviderUsageRepository & ProviderChargeRecorder {
  return Object.assign(repository, {
    async record(input: CreateProviderUsageInput): Promise<void> {
      await repository.create(input);
    },
  });
}

export function createContainer(options: CreateContainerOptions = {}): AppContainer {
  const appConfig = config;
  const log =
    options.logger ?? (appConfig.isTest ? silentLogger() : pino(buildLoggerOptions(appConfig)));
  const storage = options.storage ?? createStorageProvider(appConfig);

  const providerUsageRepository = withChargeRecording(new PrismaProviderUsageRepository(prisma));

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
    pantry: new PrismaPantryRepository(prisma),
    shoppingList: new PrismaShoppingListRepository(prisma),
    mealPlan: new PrismaMealPlanRepository(prisma),
    collection: new PrismaCollectionRepository(prisma),
    providerUsage: providerUsageRepository,
  };

  const contentRegistry = createContentRegistry(appConfig);
  const contentAcquisition = new ContentAcquisitionService(
    contentRegistry,
    log,
    providerUsageRepository,
  );
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
      log,
    );

    return queueInstance;
  };

  const queue =
    queueInstance ??
    (options.queue === undefined ? new LazyQueueProvider(createQueue) : createQueue());

  const extractionJobService = new ExtractionJobService(
    repositories.extractionJob,
    repositories.recipeSource,
    contentRegistry,
    queue,
    log,
  );

  const categoryService = new CategoryService(prisma);
  const cookSessionService = new CookSessionService(repositories.cookSession, repositories.recipe);
  const profileBootstrap = new ProfileBootstrapService(repositories.profileBootstrap);
  const profileResolver = options.profileResolver ?? new ImplicitProfileResolver();

  const pantryCache =
    options.pantryCache ??
    (appConfig.isTest
      ? new MemoryClassificationCache()
      : new RedisBackedClassificationCache(getRedisClient()));
  const ingredientLog = log.child({ component: 'ingredient-organizer' });
  const pantryLlm =
    options.pantryLlm !== undefined
      ? options.pantryLlm
      : appConfig.ai.openaiApiKey
        ? new OpenAIProvider(appConfig, null, undefined, ingredientLog)
        : null;
  const pantryUsage = new AIUsageTracker(repositories.aiUsage, DEFAULT_PRICING);
  const pantryService = new PantryService(
    repositories.pantry,
    new IngredientOrganizer(appConfig, pantryCache, pantryLlm, pantryUsage, ingredientLog),
  );
  const assistLog = log.child({ component: 'recipe-assistant' });
  const recipeAssistant = new RecipeAssistant(
    appConfig,
    options.assistLlm !== undefined
      ? options.assistLlm
      : appConfig.ai.openaiApiKey
        ? new OpenAIProvider(appConfig, null, undefined, assistLog)
        : null,
    assistLog,
  );
  const translationLog = log.child({ component: 'recipe-translator' });
  const recipeTranslator = new RecipeTranslator(
    appConfig,
    options.translationLlm !== undefined
      ? options.translationLlm
      : appConfig.ai.openaiApiKey
        ? new OpenAIProvider(appConfig, null, undefined, translationLog)
        : null,
    translationLog,
  );
  const recipeService = new RecipeService(
    repositories.recipe,
    new RecipeTranslationService(repositories.recipe, recipeTranslator, translationLog),
  );
  const shoppingListService = new ShoppingListService(
    repositories.shoppingList,
    repositories.pantry,
    repositories.recipe,
  );
  const mealPlanService = new MealPlanService(
    repositories.mealPlan,
    repositories.recipe,
    shoppingListService,
  );
  const collectionService = new CollectionService(repositories.collection);
  const dashboardService = new DashboardService(
    prisma,
    new FileLogReader(appConfig.logging.directory),
  );

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
    recipeAssistant,
    categoryService,
    cookSessionService,
    profileBootstrap,
    profileResolver,
    dashboardService,
    pipeline,
    pantryService,
    shoppingListService,
    mealPlanService,
    collectionService,
    createQueue,
  };
}

/** Test container with in-memory queues for synchronous pipeline execution. */
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
