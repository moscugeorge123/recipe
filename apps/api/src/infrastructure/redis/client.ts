import { Redis } from 'ioredis';

import { config } from '../../config/env.js';

let redisClient: Redis | undefined;

/** Returns a shared Redis connection for BullMQ and health checks. */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  return redisClient;
}

/** Closes the shared Redis connection during graceful shutdown. */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = undefined;
  }
}
