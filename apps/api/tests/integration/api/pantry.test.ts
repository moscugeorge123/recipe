import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { LLMInput, LLMProvider, LLMResult } from '../../../src/infrastructure/ai/llm/llm-provider.js';
import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

class ScriptedLLM implements LLMProvider {
  calls = 0;

  async generateStructured<T>(input: LLMInput): Promise<LLMResult<T>> {
    this.calls += 1;
    const user = input.messages.find((message) => message.role === 'user')?.content ?? '';
    const items = user
      .split('\n')
      .filter((line) => /^\d+\t/.test(line))
      .map((line) => {
        const [index, name] = line.split('\t');
        return {
          i: Number(index),
          n: name ?? 'item',
          c: 'Pantry',
          e: '🥣',
          t: 'peach',
          q: null,
          u: null,
          k: 0.88,
        };
      });
    return {
      data: { items } as T,
      model: input.model ?? 'gpt-5-nano',
      usage: { inputTokens: 20, outputTokens: 10 },
      durationMs: 5,
    };
  }
}

describe.skipIf(!dbAvailable)('pantry API', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  afterAll(() => disconnectTestDatabase());

  afterEach(async () => {
    await app.close();
  });

  describe('without an API key', () => {
    beforeEach(async () => {
      await resetDatabase(prisma);
      app = await buildTestApp({
        container: createTestContainer({ enableMediaProcessing: false, pantryLlm: null }),
      });
    });

    it('organizes dictionary text and keeps raw input on fallback items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pantry/organize',
        payload: { text: 'olive oil\ngochujang, salt' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json().data as {
        items: Array<{ canonicalName: string; rawText: string; source: string }>;
        unresolved: Array<{ rawText: string }>;
      };
      expect(body.items.map((item) => item.canonicalName)).toEqual(
        expect.arrayContaining(['olive oil', 'salt']),
      );
      const unknown = body.items.find((item) => item.rawText === 'gochujang');
      expect(unknown?.source).toBe('fallback');
      expect(unknown?.rawText).toBe('gochujang');
      expect(body.unresolved.some((item) => item.rawText === 'gochujang')).toBe(true);
    });

    it('saves, lists, corrects, filters, and deletes items without losing raw text', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/pantry/items',
        payload: {
          items: [
            {
              name: 'Olive oil',
              canonicalName: 'olive oil',
              rawText: 'olive oil',
              category: 'Pantry',
              emoji: '🫒',
              colorToken: 'peach',
            },
            {
              name: 'Lemon',
              canonicalName: 'lemon',
              rawText: '2 lemons',
              category: 'Produce',
              emoji: '🍋',
              colorToken: 'honey50',
            },
          ],
        },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().data).toHaveLength(2);

      const listed = await app.inject({ method: 'GET', url: '/api/v1/pantry' });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().data).toHaveLength(2);
      expect(listed.json().data[0].rawText).toBeTruthy();

      const produce = await app.inject({
        method: 'GET',
        url: '/api/v1/pantry?category=Produce',
      });
      expect(produce.json().data).toHaveLength(1);
      expect(produce.json().data[0].canonicalName).toBe('lemon');

      const lemonId = produce.json().data[0].id as string;
      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/pantry/items/${lemonId}`,
        payload: { name: 'Meyer lemon', category: 'Produce' },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json().data.name).toBe('Meyer lemon');
      expect(patched.json().data.rawText).toBe('2 lemons');
      expect(patched.json().data.classification.source).toBe('user');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/v1/pantry/items/${lemonId}`,
      });
      expect(deleted.statusCode).toBe(200);
      expect(deleted.json().data).toEqual({ id: lemonId, deleted: true });

      const remaining = await app.inject({ method: 'GET', url: '/api/v1/pantry' });
      expect(remaining.json().data).toHaveLength(1);
    });

    it('dedupes saved items by canonical name', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pantry/items',
        payload: { items: [{ name: 'Salt', canonicalName: 'salt', rawText: 'salt' }] },
      });
      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/pantry/items',
        payload: { items: [{ name: 'Sare', canonicalName: 'salt', rawText: 'sare' }] },
      });
      expect(second.statusCode).toBe(201);
      const listed = await app.inject({ method: 'GET', url: '/api/v1/pantry' });
      expect(listed.json().data).toHaveLength(1);
      expect(listed.json().data[0].rawText).toContain('sare');
    });
  });

  describe('with a scripted model', () => {
    const llm = new ScriptedLLM();

    beforeEach(async () => {
      llm.calls = 0;
      await resetDatabase(prisma);
      app = await buildTestApp({
        container: createTestContainer({ enableMediaProcessing: false, pantryLlm: llm }),
      });
    });

    it('records usage for a batched organize call', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pantry/organize',
        payload: { text: 'gochujang\nkecap manis' },
      });
      expect(response.statusCode).toBe(200);
      expect(llm.calls).toBe(1);
      expect(response.json().data.meta.modelsUsed).toContain('gpt-5-nano');

      const usage = await prisma.aIUsage.findMany({
        where: { operation: 'pantry_organize_batch' },
      });
      expect(usage.length).toBeGreaterThan(0);
      expect(usage[0]?.userId).toBeTruthy();
      expect(usage[0]?.jobId).toBeNull();
    });
  });
});
