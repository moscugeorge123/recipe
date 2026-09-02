import { describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../../../src/config/env.js';
import type { LLMInput, LLMProvider, LLMResult } from '../../../../src/infrastructure/ai/llm/llm-provider.js';
import { AIUsageTracker } from '../../../../src/infrastructure/ai/usage/ai-usage-tracker.js';
import { DEFAULT_PRICING } from '../../../../src/infrastructure/ai/usage/pricing.js';
import type { IAIUsageRepository } from '../../../../src/infrastructure/database/repositories/ai-usage.repository.js';
import { MemoryClassificationCache } from '../../../../src/modules/pantry/application/classification-cache.js';
import { IngredientOrganizer } from '../../../../src/modules/pantry/application/ingredient-organizer.js';

function config(env: Record<string, string> = {}): AppConfig {
  return loadConfig({ NODE_ENV: 'test', LOG_DIR: '', ...env });
}

function usage(): { tracker: AIUsageTracker; records: Array<{ operation: string; model: string }> } {
  const records: Array<{ operation: string; model: string }> = [];
  const repo: IAIUsageRepository = {
    create: async (input) => {
      records.push({ operation: input.operation, model: input.model });
      return { ...input, id: 'u', createdAt: new Date() } as never;
    },
    findByJobId: async () => [],
  };
  return { tracker: new AIUsageTracker(repo, DEFAULT_PRICING), records };
}

class ScriptedLLM implements LLMProvider {
  readonly calls: LLMInput[] = [];

  constructor(private readonly impl: (input: LLMInput) => unknown) {}

  async generateStructured<T>(input: LLMInput): Promise<LLMResult<T>> {
    this.calls.push(input);
    return {
      data: this.impl(input) as T,
      model: input.model ?? 'scripted',
      usage: { inputTokens: 16, outputTokens: 9 },
      durationMs: 4,
    };
  }
}

function compactFromPrompt(
  input: LLMInput,
  extra?: Partial<{ n: string; c: string; e: string; t: string; k: number }>,
): { items: Array<Record<string, unknown>> } {
  const user = input.messages.find((message) => message.role === 'user')?.content ?? '';
  const items = user
    .split('\n')
    .filter((line) => /^\d+\t/.test(line))
    .map((line) => {
      const [index, name] = line.split('\t');
      return {
        i: Number(index),
        n: extra?.n ?? name ?? 'unknown',
        c: extra?.c ?? 'Pantry',
        e: extra?.e ?? '🥣',
        t: extra?.t ?? 'peach',
        q: null,
        u: null,
        k: extra?.k ?? 0.9,
      };
    });
  return { items };
}

const userId = '00000000-0000-4000-8000-000000000001';

describe('IngredientOrganizer', () => {
  it('resolves dictionary items without calling the model', async () => {
    const llm = new ScriptedLLM(() => {
      throw new Error('should not be called');
    });
    const { tracker, records } = usage();
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      llm,
      tracker,
    );

    const result = await organizer.organize({
      userId,
      text: 'olive oil\nsare, ajo, beurre',
    });

    expect(llm.calls).toHaveLength(0);
    expect(result.items.map((item) => item.canonicalName).sort()).toEqual([
      'butter',
      'garlic',
      'olive oil',
      'salt',
    ]);
    expect(result.items.every((item) => item.source === 'dictionary')).toBe(true);
    expect(result.unresolved).toHaveLength(0);
    expect(records.filter((row) => row.operation.startsWith('pantry_organize_batch'))).toHaveLength(
      0,
    );
  });

  it('preserves raw text and dedupes by canonical name', async () => {
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      null,
      null,
    );
    const result = await organizer.organize({
      userId,
      text: 'salt\nsare\nSalt',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.canonicalName).toBe('salt');
    expect(result.items[0]?.rawText.split('\n')).toEqual(
      expect.arrayContaining(['salt', 'sare', 'Salt']),
    );
  });

  it('falls back deterministically when there is no API key', async () => {
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      null,
      null,
    );
    const result = await organizer.organize({
      userId,
      text: 'gochujang\nkecap manis',
    });
    expect(result.meta.aiAvailable).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.source === 'fallback')).toBe(true);
    expect(result.unresolved.every((item) => item.retryable)).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['gochujang', 'kecap manis']);
  });

  it('batches unknown items in one compact call and does not use gpt-4o-mini for the batch', async () => {
    const llm = new ScriptedLLM((input) => compactFromPrompt(input));
    const { tracker, records } = usage();
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      llm,
      tracker,
    );

    const result = await organizer.organize({
      userId,
      text: 'gochujang\nkecap manis\nzaatar blend',
    });

    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]?.model).toBe('gpt-5-nano');
    expect(llm.calls[0]?.reasoningEffort).toBe('none');
    expect(llm.calls[0]?.maxTokens).toBe(1024);
    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.source === 'ai')).toBe(true);
    expect(records.some((row) => row.operation === 'pantry_organize_batch')).toBe(true);
    expect(llm.calls.every((call) => call.model !== 'gpt-4o-mini')).toBe(true);
  });

  it('uses the cache on a repeat batch', async () => {
    const llm = new ScriptedLLM((input) => compactFromPrompt(input));
    const cache = new MemoryClassificationCache();
    const organizer = new IngredientOrganizer(config(), cache, llm, null);

    await organizer.organize({ userId, text: 'gochujang' });
    const second = await organizer.organize({ userId, text: 'gochujang' });

    expect(llm.calls).toHaveLength(1);
    expect(second.meta.cacheHits).toBe(1);
    expect(second.items[0]?.source).toBe('cache');
  });

  it('falls back to gpt-4.1-nano when the primary batch fails', async () => {
    const llm = new ScriptedLLM((input) => {
      if (input.model === 'gpt-5-nano') {
        throw new Error('timeout');
      }
      return compactFromPrompt(input);
    });
    const { records } = usage();
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      llm,
      usage().tracker,
    );
    void records;

    const result = await organizer.organize({ userId, text: 'gochujang' });
    expect(llm.calls.map((call) => call.model)).toEqual(['gpt-5-nano', 'gpt-4.1-nano']);
    expect(result.items[0]?.source).toBe('ai');
  });

  it('escalates only individual low-confidence items to gpt-4o-mini', async () => {
    const llm = new ScriptedLLM((input) => {
      if (input.model === 'gpt-4o-mini') {
        return compactFromPrompt(input, { k: 0.92, n: 'Gochujang', c: 'Pantry' });
      }
      return compactFromPrompt(input, { k: 0.2 });
    });
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      llm,
      null,
    );

    const result = await organizer.organize({ userId, text: 'gochujang\nkecap manis' });
    const batchCalls = llm.calls.filter((call) => call.model === 'gpt-5-nano');
    const miniCalls = llm.calls.filter((call) => call.model === 'gpt-4o-mini');
    expect(batchCalls).toHaveLength(1);
    expect(miniCalls.length).toBeGreaterThan(0);
    expect(miniCalls.length).toBeLessThanOrEqual(2);
    expect(result.meta.escalatedCount).toBeGreaterThan(0);
    expect(result.items.every((item) => item.confidence > 0.5)).toBe(true);
  });

  it('uses deterministic fallback when the model returns malformed output', async () => {
    const llm = new ScriptedLLM(() => ({ prose: 'sorry here is a paragraph' }));
    const organizer = new IngredientOrganizer(
      config(),
      new MemoryClassificationCache(),
      llm,
      null,
    );
    const result = await organizer.organize({ userId, text: 'gochujang' });
    expect(result.items[0]?.source).toBe('fallback');
    expect(result.items[0]?.rawText).toBe('gochujang');
    expect(result.unresolved[0]?.reason).toBe('malformed');
  });

  it('enforces the per-request item budget and leaves extra lines retryable', async () => {
    const llm = new ScriptedLLM((input) => compactFromPrompt(input));
    const organizer = new IngredientOrganizer(
      config({ AI_INGREDIENT_MAX_ITEMS: '2' }),
      new MemoryClassificationCache(),
      llm,
      null,
    );
    const result = await organizer.organize({
      userId,
      text: 'gochujang\nkecap manis\nzaatar blend\nsumac',
    });
    expect(result.meta.truncated).toBe(true);
    expect(result.unresolved.some((item) => item.reason === 'budget')).toBe(true);
    expect(result.unresolved.map((item) => item.rawText)).toEqual(
      expect.arrayContaining(['zaatar blend', 'sumac']),
    );
  });

  it('never sends gpt-4o-mini as the whole-batch model even if configured as primary', async () => {
    const llm = new ScriptedLLM((input) => compactFromPrompt(input));
    const organizer = new IngredientOrganizer(
      config({ AI_INGREDIENT_MODEL: 'gpt-4o-mini' }),
      new MemoryClassificationCache(),
      llm,
      null,
    );
    await organizer.organize({ userId, text: 'gochujang' });
    expect(llm.calls[0]?.model).toBe('gpt-4.1-nano');
    expect(llm.calls.filter((call) => call.model === 'gpt-4o-mini')).toHaveLength(0);
  });
});
