import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../helpers/build-test-app.js';

/** Just enough of the OpenAPI shape to make these assertions type-safe and readable. */
interface OpenApiOperation {
  parameters?: { name: string; in: string }[];
  requestBody?: { content: Record<string, { schema: unknown }> };
  responses: Record<
    string,
    { content?: Record<string, { schema: { properties?: Record<string, unknown> } }> }
  >;
}

interface OpenApiDocument {
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, unknown> };
}

describe('API documentation', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('serves Swagger UI at /docs', async () => {
    app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/docs' });

    // Swagger UI redirects to its own index page.
    expect([200, 302]).toContain(response.statusCode);
  });

  it('describes every endpoint in the OpenAPI document', async () => {
    app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const spec = response.json<OpenApiDocument>();

    expect(response.statusCode).toBe(200);
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths).sort()).toEqual([
      '/api/v1/categories',
      '/api/v1/categories/{categoryId}',
      '/api/v1/collections',
      '/api/v1/collections/{id}',
      '/api/v1/collections/{id}/recipes',
      '/api/v1/collections/{id}/recipes/{recipeId}',
      '/api/v1/cook-sessions',
      '/api/v1/cook-sessions/{id}',
      '/api/v1/health',
      '/api/v1/meal-plan',
      '/api/v1/meal-plan/entries',
      '/api/v1/meal-plan/entries/{id}',
      '/api/v1/meal-plan/reorder',
      '/api/v1/ops/summary',
      '/api/v1/pantry',
      '/api/v1/pantry/items',
      '/api/v1/pantry/items/{id}',
      '/api/v1/pantry/organize',
      '/api/v1/recipes',
      '/api/v1/recipes/extract',
      '/api/v1/recipes/extract/jobs/{id}',
      '/api/v1/recipes/extract/jobs/{id}/cancel',
      '/api/v1/recipes/preview',
      '/api/v1/recipes/{id}',
      '/api/v1/recipes/{id}/categories',
      '/api/v1/recipes/{id}/favorite',
      '/api/v1/recipes/{id}/notes',
      '/api/v1/recipes/{id}/notes/{noteId}',
      '/api/v1/recipes/{id}/nutrition',
      '/api/v1/recipes/{id}/nutrition/matches',
      '/api/v1/recipes/{id}/nutrition/recalculate',
      '/api/v1/recipes/{id}/rating',
      '/api/v1/recipes/{id}/review-state',
      '/api/v1/recipes/{id}/revisions',
      '/api/v1/recipes/{id}/revisions/{revisionId}',
      '/api/v1/recipes/{id}/revisions/{revisionId}/restore',
      '/api/v1/shopping-list',
      '/api/v1/shopping-list/clear-done',
      '/api/v1/shopping-list/from-recipe',
      '/api/v1/shopping-list/items',
      '/api/v1/shopping-list/items/{id}',
    ]);
  });

  it('documents request parameters, bodies and responses', async () => {
    app = await buildTestApp();

    const spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenApiDocument>();

    const list = spec.paths['/api/v1/recipes']?.['get'];
    expect(list?.parameters?.map((parameter) => parameter.name).sort()).toEqual([
      'cuisine',
      'page',
      'pageSize',
      'q',
      'sort',
      'sourceType',
    ]);
    expect(
      list?.responses['200']?.content?.['application/json']?.schema.properties?.['meta'],
    ).toBeDefined();

    const create = spec.paths['/api/v1/recipes/extract']?.['post'];
    expect(create?.requestBody?.content['application/json']?.schema).toBeDefined();
    expect(create?.responses['202']).toBeDefined();

    const byId = spec.paths['/api/v1/recipes/{id}']?.['get'];
    expect(byId?.parameters?.[0]).toMatchObject({ name: 'id', in: 'path' });
    expect(byId?.responses['404']).toBeDefined();

    const patch = spec.paths['/api/v1/recipes/{id}']?.['patch'];
    expect(patch?.requestBody?.content['application/json']?.schema).toBeDefined();
    expect(patch?.responses['200']).toBeDefined();
    expect(patch?.responses['404']).toBeDefined();
    expect(patch?.responses['409']).toBeDefined();
  });

  it('documents the shared error envelope for failure responses', async () => {
    app = await buildTestApp();

    const spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenApiDocument>();
    const responses = spec.paths['/api/v1/recipes']?.['get']?.responses ?? {};

    for (const status of ['400', '429', '500']) {
      expect(responses[status], `status ${status} should be documented`).toBeDefined();
    }

    expect(spec.components.schemas['ErrorResponse']).toBeDefined();
  });

  it('is disabled when ENABLE_DOCS is false', async () => {
    app = await buildTestApp({ env: { ENABLE_DOCS: 'false' } });

    const docs = await app.inject({ method: 'GET', url: '/docs' });
    const json = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(docs.statusCode).toBe(404);
    expect(json.statusCode).toBe(404);
  });

  it('is disabled by default in production', async () => {
    app = await buildTestApp({ env: { NODE_ENV: 'production' } });

    const docs = await app.inject({ method: 'GET', url: '/docs' });

    expect(docs.statusCode).toBe(404);
  });
});
