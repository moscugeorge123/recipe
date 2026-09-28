import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../../config/env.js';

/**
 * CORS is configured from an explicit allow-list — never `*`.
 *
 * Note for the mobile client: React Native's `fetch` is not a browser and is not subject to
 * the same-origin policy, so an empty `CORS_ORIGINS` list is perfectly fine for a mobile-only
 * API. The allow-list exists for web clients (Expo web, an admin dashboard, local tooling)
 * and is populated per environment.
 */
export async function registerCors(app: FastifyInstance, config: AppConfig): Promise<void> {
  const allowedOrigins = config.cors.origins;

  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // `Authorization` is listed ahead of the authentication work so the mobile client will not
    // need a CORS change when tokens are introduced.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Firebase-AppCheck'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    credentials: false,
    maxAge: 86_400,
  });
}
