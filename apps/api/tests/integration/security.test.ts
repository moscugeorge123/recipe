import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../helpers/build-test-app.js';

describe('security', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  describe('CORS', () => {
    it('allows a configured origin', async () => {
      app = await buildTestApp({ env: { CORS_ORIGINS: 'http://localhost:8081' } });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'http://localhost:8081' },
      });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    });

    it('does not allow an unconfigured origin', async () => {
      app = await buildTestApp({ env: { CORS_ORIGINS: 'http://localhost:8081' } });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'https://evil.example.com' },
      });

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers preflight requests with the methods and headers the client needs', async () => {
      app = await buildTestApp({ env: { CORS_ORIGINS: 'http://localhost:8081' } });

      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/recipes/extract',
        headers: {
          origin: 'http://localhost:8081',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8081');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      // Present ahead of the auth work so adding tokens needs no CORS change.
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('never falls back to a wildcard when no origins are configured', async () => {
      app = await buildTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'https://evil.example.com' },
      });

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('security headers', () => {
    it('sets the headers provided by helmet', async () => {
      app = await buildTestApp();

      const response = await app.inject({ method: 'GET', url: '/docs/json' });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['content-security-policy']).toBeTypeOf('string');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('does not advertise the framework', async () => {
      app = await buildTestApp();

      const response = await app.inject({ method: 'GET', url: '/docs/json' });

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('rate limiting', () => {
    it('rejects requests over the limit with the standard envelope', async () => {
      app = await buildTestApp({ env: { RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' } });

      const statuses: number[] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await app.inject({ method: 'GET', url: '/docs/json' });
        statuses.push(response.statusCode);
      }

      expect(statuses).toEqual([200, 200, 429]);

      const limited = await app.inject({ method: 'GET', url: '/docs/json' });
      expect(limited.json().error.code).toBe('TOO_MANY_REQUESTS');
      expect(limited.headers['retry-after']).toBeDefined();
    });

    it('exposes the remaining allowance to clients', async () => {
      app = await buildTestApp({ env: { RATE_LIMIT_MAX: '5' } });

      const response = await app.inject({ method: 'GET', url: '/docs/json' });

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });

    it('also limits requests to unknown routes', async () => {
      app = await buildTestApp({ env: { RATE_LIMIT_MAX: '1' } });

      await app.inject({ method: 'GET', url: '/probe-1' });
      const second = await app.inject({ method: 'GET', url: '/probe-2' });

      expect(second.statusCode).toBe(429);
    });

    it('can be disabled entirely', async () => {
      app = await buildTestApp({ env: { RATE_LIMIT_ENABLED: 'false', RATE_LIMIT_MAX: '1' } });

      const statuses: number[] = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await app.inject({ method: 'GET', url: '/docs/json' });
        statuses.push(response.statusCode);
      }

      expect(statuses).toEqual([200, 200, 200, 200]);
    });

    it('applies the extract cap only to creating jobs, not to status polling', async () => {
      app = await buildTestApp({
        env: {
          RATE_LIMIT_MAX: '2',
          EXTRACTION_EXTRACT_RATE_LIMIT_MAX: '2',
          EXTRACTION_EXTRACT_RATE_LIMIT_WINDOW_MS: '60000',
        },
      });

      const create = () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/recipes/extract',
          payload: { url: 'not-a-url' },
        });

      expect((await create()).statusCode).toBe(400);
      expect((await create()).statusCode).toBe(400);
      expect((await create()).statusCode).toBe(429);

      const pollStatuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/recipes/extract/jobs/33333333-3333-4333-8333-333333333333',
        });
        pollStatuses.push(response.statusCode);
      }

      expect(pollStatuses.every((status) => status !== 429)).toBe(true);
    });
  });
});
