import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestContainer } from '../../src/shared/di/container.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('health endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['/health', '/api/v1/health'])(
    'GET %s returns a machine-readable status',
    async (url) => {
      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
      expect(response.headers['content-type']).toContain('application/json');
    },
  );

  it('returns the request id so clients can quote it in bug reports', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not resolve a profile for either health route', async () => {
    const resolve = vi.fn().mockRejectedValue(new Error('profile store unavailable'));
    const isolated = await buildTestApp({
      container: createTestContainer({ profileResolver: { resolve } }),
    });

    try {
      for (const url of ['/health', '/api/v1/health']) {
        const response = await isolated.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(200);
      }
      expect(resolve).not.toHaveBeenCalled();

      const resource = await isolated.inject({ method: 'GET', url: '/api/v1/recipes' });
      expect(resource.statusCode).toBe(500);
      expect(resolve).toHaveBeenCalledOnce();
    } finally {
      await isolated.close();
    }
  });

  it('reuses a well-formed client request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'mobile-trace-0001' },
    });

    expect(response.headers['x-request-id']).toBe('mobile-trace-0001');
  });

  it('ignores a malformed client request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'no' },
    });

    expect(response.headers['x-request-id']).not.toBe('no');
  });

  it('is never rate limited, because the load balancer polls it continuously', async () => {
    const limited = await buildTestApp({ env: { RATE_LIMIT_MAX: '1' } });

    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await limited.inject({ method: 'GET', url: '/health' });
        statuses.push(response.statusCode);
      }

      expect(statuses).toEqual([200, 200, 200, 200, 200]);
    } finally {
      await limited.close();
    }
  });

  describe('with dependency checks registered', () => {
    it('reports each dependency when all are healthy', async () => {
      const withChecks = await buildTestApp({
        healthChecks: [{ name: 'database', check: async () => undefined }],
      });

      try {
        const response = await withChecks.inject({ method: 'GET', url: '/api/v1/health' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          status: 'ok',
          checks: [{ name: 'database', status: 'ok', durationMs: expect.any(Number) }],
        });
      } finally {
        await withChecks.close();
      }
    });

    it('returns 503 and hides the underlying error when a dependency is down', async () => {
      const withChecks = await buildTestApp({
        healthChecks: [
          {
            name: 'database',
            check: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.1.15:5432')),
          },
        ],
      });

      try {
        const response = await withChecks.inject({ method: 'GET', url: '/health' });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({
          status: 'error',
          checks: [{ name: 'database', status: 'error', durationMs: expect.any(Number) }],
        });
        // Connection strings and hostnames must not reach an unauthenticated endpoint.
        expect(response.body).not.toContain('ECONNREFUSED');
        expect(response.body).not.toContain('10.0.1.15');
      } finally {
        await withChecks.close();
      }
    });
  });

  it('serves the versioned health route under a custom API prefix', async () => {
    const prefixed = await buildTestApp({ env: { API_PREFIX: '/api/v2' } });

    try {
      await expect(
        prefixed.inject({ method: 'GET', url: '/api/v2/health' }).then((r) => r.statusCode),
      ).resolves.toBe(200);
      await expect(
        prefixed.inject({ method: 'GET', url: '/api/v1/health' }).then((r) => r.statusCode),
      ).resolves.toBe(404);
    } finally {
      await prefixed.close();
    }
  });
});
