import pino from 'pino';

import { config, type AppConfig } from '../config/env.js';
import { isFfmpegAvailable } from '../modules/media/ffmpeg/ffmpeg-media-processor.js';
import { isYtDlpAvailable } from '../modules/content/providers/youtube/ytdlp-client.js';
import { createContainer } from '../shared/di/container.js';
import { disconnectPrisma } from '../infrastructure/database/prisma/client.js';
import { disconnectRedis, getRedisClient } from '../infrastructure/redis/client.js';
import {
  closeExtractionProcessor,
  registerExtractionProcessor,
} from './processors/extraction.processor.js';

export function createWorkerLogger(appConfig: AppConfig = config): pino.Logger {
  return pino({
    level: appConfig.logging.level,
    base: {
      service: appConfig.service.name,
      version: appConfig.service.version,
      env: appConfig.nodeEnv,
    },
  });
}

export async function startWorker(appConfig: AppConfig = config): Promise<pino.Logger> {
  const log = createWorkerLogger(appConfig);

  const redis = getRedisClient();
  await redis.connect();
  await redis.ping();

  const container = createContainer();
  await registerExtractionProcessor(container);

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
    },
    'Worker started',
  );

  return log;
}

export function registerWorkerShutdown(log: pino.Logger, appConfig: AppConfig = config): void {
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
