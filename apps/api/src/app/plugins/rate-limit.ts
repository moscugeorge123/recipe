import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../../config/env.js';

/**
 * Request rate limiting.
 *
 * The default store is per-process, which means that with N Fargate tasks the effective limit
 * is N x RATE_LIMIT_MAX. That is an acceptable, self-contained default for a boilerplate and is
 * still a useful shield against a single misbehaving client.
 *
 * To make limits exact across tasks, pass a shared store — the plugin accepts a `redis` option
 * (e.g. an ElastiCache Valkey/Redis endpoint) with no other application changes:
 *
 *   await app.register(rateLimit, { ...options, redis: new Redis(config.redis.url) });
 *
 * Rate limit rejections are thrown as 429 errors and are formatted by the central error handler,
 * so clients always receive the standard error envelope.
 *
 * Behind an ALB, set `TRUST_PROXY=true` so limits are keyed on the real client IP taken from
 * `X-Forwarded-For` rather than on the load balancer's address.
 */
export async function registerRateLimit(app: FastifyInstance, config: AppConfig): Promise<void> {
  if (!config.rateLimit.enabled) {
    app.log.warn('Rate limiting is disabled');
    return;
  }

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    // Fail open: if a shared store is added later and becomes unreachable, serve traffic
    // instead of returning 429 to everyone.
    skipOnError: true,
    hook: 'onRequest',
  });
}
