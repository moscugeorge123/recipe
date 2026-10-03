import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

import type { AppConfig } from '../../config/env.js';

export const DOCS_ROUTE_PREFIX = '/docs';

/**
 * OpenAPI 3.1 document generation and Swagger UI.
 *
 * The specification is derived from the same Zod schemas the routes validate with, so the
 * documentation cannot drift from the implementation: changing a schema changes both.
 *
 * Disabled by default in production (`ENABLE_DOCS`). If you do want to publish the docs,
 * prefer exposing them through a separate, protected ALB rule.
 */
export async function registerSwagger(app: FastifyInstance, config: AppConfig): Promise<void> {
  if (!config.api.docsEnabled) {
    return;
  }

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: `${config.service.name} API`,
        description: [
          'REST API consumed by the mobile application.',
          '',
          'Conventions:',
          '- Resources are returned as `{ "data": ... }`; collections add `{ "meta": ... }`.',
          '- Failures return `{ "error": { "code", "message", "details?", "requestId?", "retryable?" } }`.',
          '- Clients should branch on `error.code`, not on the message text.',
          '- `/health` is unauthenticated and returns a flat document for load balancers.',
        ].join('\n'),
        version: config.service.version,
      },
      servers: [{ url: '/', description: 'Current host' }],
      tags: [
        { name: 'health', description: 'Liveness and dependency checks' },
        { name: 'extraction', description: 'Recipe extraction jobs' },
        { name: 'recipes', description: 'Extracted recipes' },
        { name: 'cook-sessions', description: 'In-progress and finished cook sessions' },
        { name: 'collections', description: 'User recipe collections' },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  await app.register(swaggerUi, {
    routePrefix: DOCS_ROUTE_PREFIX,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
