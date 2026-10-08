import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ForbiddenError, UnauthorizedError } from '../../src/shared/errors/app-error.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('error handling', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns the standard envelope for unknown routes', async () => {
    app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /does-not-exist not found',
        requestId: expect.any(String),
        retryable: false,
      },
    });
  });

  it('returns 400 for malformed JSON', async () => {
    app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { 'content-type': 'application/json' },
      body: '{"url": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('returns 415 for a content type the API cannot parse', async () => {
    app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { 'content-type': 'application/xml' },
      body: '<recipe><url>test</url></recipe>',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a parseable but wrongly typed body with a validation error', async () => {
    app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { 'content-type': 'text/plain' },
      body: 'url=https://example.com',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 413 when the body exceeds the configured limit', async () => {
    app = await buildTestApp({ env: { BODY_LIMIT_BYTES: '128' } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      payload: { url: 'https://example.com/' + 'x'.repeat(500) },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('hides internal failures behind a generic 500', async () => {
    app = await buildTestApp({
      setup: (instance) => {
        instance.get('/boom', () => {
          throw new Error('password=hunter2 at /var/task/src/db.ts:42');
        });
      },
    });

    const response = await app.inject({ method: 'GET', url: '/boom' });
    const body = response.json();

    expect(response.statusCode).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId: expect.any(String),
      retryable: true,
    });
    // Nothing from the original error may reach the client.
    expect(response.body).not.toContain('hunter2');
    expect(response.body).not.toContain('db.ts');
    expect(response.body).not.toContain('stack');
  });

  it('does not leak a response that fails its own schema', async () => {
    app = await buildTestApp({
      setup: (instance) => {
        instance.get(
          '/bad-response',
          { schema: { response: { 200: z.object({ requiredField: z.string() }) } } },
          // Deliberately violates the declared schema, simulating a serialisation bug.
          async () => ({ wrongField: 'internal detail' }),
        );
      },
    });

    const response = await app.inject({ method: 'GET', url: '/bad-response' });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body).not.toContain('internal detail');
  });

  it('maps the authentication placeholders to 401 and 403', async () => {
    app = await buildTestApp({
      setup: (instance) => {
        instance.get('/needs-auth', () => {
          throw new UnauthorizedError();
        });
        instance.get('/needs-role', () => {
          throw new ForbiddenError();
        });
      },
    });

    const unauthorized = await app.inject({ method: 'GET', url: '/needs-auth' });
    const forbidden = await app.inject({ method: 'GET', url: '/needs-role' });

    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json().error.code).toBe('UNAUTHORIZED');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('FORBIDDEN');
  });
});
