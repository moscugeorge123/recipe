import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('GET /api/v1/ops/summary', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({
      container: createTestContainer({ enableMediaProcessing: false }),
    });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  it('returns empty aggregates without leaking recipe or pantry names', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/ops/summary' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      profileScoped: true,
      ai: {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        cacheCalls: 0,
        escalationCalls: 0,
        byOperation: [],
      },
      pantry: { items: 0, fallbackItems: 0, fallbackRate: 0 },
      revisions: { count: 0, conflictsPersisted: false },
      queues: { extractionInFlight: 0 },
    });
    expect(response.json().data).not.toHaveProperty('usda');
    expect(response.json().data).not.toHaveProperty('nutrition');
    expect(response.json().data.generatedAt).toEqual(expect.any(String));
    expect(response.json().data.migrations.applied).toBeGreaterThan(0);
    expect(response.json().error).toBeUndefined();
  });

  it('counts pantry fallback items after a dictionary organize', async () => {
    const organized = await app.inject({
      method: 'POST',
      url: '/api/v1/pantry/organize',
      payload: { text: 'olive oil\ngochujang' },
    });
    expect(organized.statusCode).toBe(200);
    const fallback = (
      organized.json().data.items as Array<{
        name: string;
        canonicalName: string;
        rawText: string;
        category: string;
        emoji: string;
        colorToken: string;
        source: string;
      }>
    ).find((item) => item.source === 'fallback');
    expect(fallback).toBeDefined();

    const saved = await app.inject({
      method: 'POST',
      url: '/api/v1/pantry/items',
      payload: {
        items: [
          {
            name: fallback!.name,
            canonicalName: fallback!.canonicalName,
            rawText: fallback!.rawText,
            category: fallback!.category,
            emoji: fallback!.emoji,
            colorToken: fallback!.colorToken,
            source: 'fallback',
          },
        ],
      },
    });
    expect(saved.statusCode).toBe(201);

    const summary = await app.inject({ method: 'GET', url: '/api/v1/ops/summary' });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().data.pantry.items).toBeGreaterThanOrEqual(1);
    expect(summary.json().data.pantry.fallbackItems).toBeGreaterThanOrEqual(1);
    expect(summary.json().data.pantry.fallbackRate).toBeGreaterThan(0);
    expect(JSON.stringify(summary.json())).not.toContain('gochujang');
  });
});
