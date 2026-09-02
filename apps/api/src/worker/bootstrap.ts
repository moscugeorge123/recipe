import { config, type AppConfig } from '../config/env.js';
import { createLogger, type AppLogger } from '../infrastructure/logging/logger.js';
import { isFfmpegAvailable } from '../modules/media/ffmpeg/ffmpeg-media-processor.js';
import { isYtDlpAvailable } from '../modules/content/providers/youtube/ytdlp-client.js';
import { createContainer } from '../shared/di/container.js';
import { disconnectPrisma } from '../infrastructure/database/prisma/client.js';
import { disconnectRedis, getRedisClient } from '../infrastructure/redis/client.js';
import {
  closeExtractionProcessor,
  registerExtractionProcessor,
} from './processors/extraction.processor.js';
import {
  closeNutritionProcessor,
  registerNutritionProcessor,
} from './processors/nutrition.processor.js';

export async function createWorkerLogger(appConfig: AppConfig = config): Promise<AppLogger> {
  return createLogger(appConfig);
}

export async function startWorker(appConfig: AppConfig = config): Promise<AppLogger> {
  const log = await createWorkerLogger(appConfig);

  const redis = getRedisClient();
  await redis.connect();
  await redis.ping();

  const container = createContainer({ logger: log });
  await registerExtractionProcessor(container);
  await registerNutritionProcessor(container);

  log.info(
    {
      pantryCache: 'redis-when-ready',
      ingredientModel: appConfig.ai.ingredientModel,
    },
    'Pantry organizer shares this Redis client for classification cache',
  );

  const [ytdlpOk, ffmpegOk] = await Promise.all([
    isYtDlpAvailable(appConfig.providers.ytdlpPath),
    isFfmpegAvailable(),
  ]);
  if (!ytdlpOk) {
    log.warn(
      { binary: appConfig.providers.ytdlpPath },
      'yt-dlp is not installed; YouTube extraction will fail until it is on PATH',
    );
  }
  if (!ffmpegOk) {
    log.warn('ffmpeg/ffprobe is not installed; YouTube media processing will fail');
  }

  log.info(
    {
      redisUrl: appConfig.redis.url.replace(/:[^:@/]+@/, ':***@'),
      queueConcurrency: appConfig.extraction.queueConcurrency,
      logDirectory: appConfig.logging.directory,
    },
    'Worker started',
  );

  return log;
}

export function registerWorkerShutdown(log: AppLogger, appConfig: AppConfig = config): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log.info({ signal }, 'Worker shutdown initiated');

    const watchdog = setTimeout(() => {
      log.error({ timeoutMs: appConfig.server.shutdownTimeoutMs }, 'Worker shutdown timed out');
      process.exit(1);
    }, appConfig.server.shutdownTimeoutMs);
    watchdog.unref();

    try {
      await closeExtractionProcessor();
      await closeNutritionProcessor();
      await disconnectRedis();
      await disconnectPrisma();
      clearTimeout(watchdog);
      log.info('Worker shutdown complete');
      process.exit(0);
    } catch (error: unknown) {
      clearTimeout(watchdog);
      log.error({ err: error }, 'Error during worker shutdown');
      process.exit(1);
    }
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}
