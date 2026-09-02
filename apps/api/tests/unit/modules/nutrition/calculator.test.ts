import { describe, expect, it, vi } from 'vitest';

import { InMemoryNutritionCache } from '../../../../src/modules/nutrition/application/memory-nutrition-cache.js';
import { NutritionCalculator } from '../../../../src/modules/nutrition/application/nutrition-calculator.js';
import { FakeNutritionProvider } from '../../../../src/modules/nutrition/providers/fake/fake-nutrition-provider.js';
import type { IngredientToMatch, NutritionProvider } from '../../../../src/modules/nutrition/domain/types.js';

const pasta: IngredientToMatch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Spaghetti',
  canonicalName: 'spaghetti',
  quantity: 200,
  unit: 'g',
};

const oil: IngredientToMatch = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Olive oil',
  canonicalName: 'olive oil',
  quantity: 1,
  unit: 'tbsp',
};

const mystery: IngredientToMatch = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Dragon fruit',
  canonicalName: 'dragon fruit',
  quantity: 1,
  unit: 'piece',
};

describe('NutritionCalculator', () => {
  it('totals, portions, and per-100g from matched ingredients', async () => {
    const calculator = new NutritionCalculator(new FakeNutritionProvider(), new InMemoryNutritionCache());
    const result = await calculator.calculate([pasta, oil], 2);

    expect(result.status).toBe('COMPLETED');
    expect(result.matchedCount).toBe(2);
    expect(result.coveragePercent).toBe(100);
    expect(result.wholeRecipe?.calories).toBeGreaterThan(0);
    expect(result.perServing?.calories).toBe(Math.round((result.wholeRecipe?.calories ?? 0) / 2));
    expect(result.per100g?.calories).toBeGreaterThan(0);
    expect(result.totalGrams).toBeGreaterThan(200);
  });

  it('marks partial coverage when an ingredient cannot be converted', async () => {
    const calculator = new NutritionCalculator(new FakeNutritionProvider(), new InMemoryNutritionCache());
    const result = await calculator.calculate([pasta, mystery], 2);

    expect(result.status).toBe('PARTIAL');
    expect(result.unmatchedIngredients).toEqual(['Dragon fruit']);
    expect(result.matchedCount).toBe(1);
    expect(result.coveragePercent).toBe(50);
    expect(result.wholeRecipe).not.toBeNull();
  });

  it('fails honestly when nothing can be calculated', async () => {
    const calculator = new NutritionCalculator(new FakeNutritionProvider(), new InMemoryNutritionCache());
    const result = await calculator.calculate([mystery], 2);

    expect(result.status).toBe('FAILED');
    expect(result.wholeRecipe).toBeNull();
    expect(result.failureReason).toMatch(/could be matched or converted/i);
  });

  it('reuses query and FDC caches on the second lookup', async () => {
    const provider = new FakeNutritionProvider();
    const cache = new InMemoryNutritionCache();
    const calculator = new NutritionCalculator(provider, cache);

    await calculator.calculate([pasta], 2);
    const searchesAfterFirst = provider.searchCalls;
    await calculator.calculate([pasta], 2);

    expect(provider.searchCalls).toBe(searchesAfterFirst);
    expect(cache.foods.has('fake:spaghetti')).toBe(true);
  });

  it('does not invent nutrients for unmatched rows', async () => {
    const calculator = new NutritionCalculator(new FakeNutritionProvider(), new InMemoryNutritionCache());
    const result = await calculator.calculate([pasta, mystery], 4);
    const unmatched = result.matches.find((match) => match.ingredientId === mystery.id);

    expect(unmatched?.nutrients).toBeNull();
    expect(unmatched?.grams).toBeNull();
    expect(unmatched?.unmatched).toBe(true);
  });
});

describe('NutritionCalculator provider failures', () => {
  it('propagates rate-limit errors so the queue can retry', async () => {
    const { NutritionRateLimitError } = await import(
      '../../../../src/modules/nutrition/domain/types.js'
    );
    const provider: NutritionProvider = {
      id: 'usda-fdc',
      search: vi.fn(async () => {
        throw new NutritionRateLimitError();
      }),
      getFood: vi.fn(async () => null),
    };
    const calculator = new NutritionCalculator(provider, new InMemoryNutritionCache());

    await expect(calculator.calculate([pasta], 2)).rejects.toBeInstanceOf(NutritionRateLimitError);
  });
});
