import { describe, expect, it, vi } from 'vitest';

import { NutritionRateLimitError } from '../../../../src/modules/nutrition/domain/types.js';
import { UsdaFdcProvider } from '../../../../src/modules/nutrition/providers/usda/usda-fdc-provider.js';

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('UsdaFdcProvider', () => {
  it('prefers Foundation foods and maps nutrients per 100g', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        foods: [
          {
            fdcId: 1,
            description: 'Pasta, dry',
            dataType: 'SR Legacy',
            score: 90,
            foodNutrients: [{ nutrient: { id: 1008, unitName: 'KCAL' }, amount: 350 }],
            foodPortions: [{ gramWeight: 100, amount: 1, measureUnit: { name: 'g' } }],
          },
          {
            fdcId: 2,
            description: 'Pasta, dry, enriched',
            dataType: 'Foundation',
            score: 80,
            foodNutrients: [
              { nutrient: { id: 1008, unitName: 'KCAL' }, amount: 371 },
              { nutrient: { id: 1003, unitName: 'G' }, amount: 13 },
            ],
            foodPortions: [{ gramWeight: 100, amount: 1, measureUnit: { name: 'g' } }],
          },
        ],
      }),
    );

    const provider = new UsdaFdcProvider({ apiKey: 'test-key', fetchImpl });
    const match = await provider.search({ query: 'pasta' });

    expect(match?.fdcId).toBe('2');
    expect(match?.dataType).toBe('Foundation');
    expect(match?.nutrientsPer100g.calories).toBe(371);
    expect(match?.nutrientsPer100g.proteinGrams).toBe(13);
  });

  it('retries 429 with bounded backoff and then throws', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { error: 'rate limited' }, { 'retry-after': '0' }));
    const provider = new UsdaFdcProvider({
      apiKey: 'test-key',
      fetchImpl,
      maxRetries: 2,
      backoffMs: 1,
      maxBackoffMs: 5,
    });

    await expect(provider.search({ query: 'pasta' })).rejects.toBeInstanceOf(NutritionRateLimitError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('succeeds after a single 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          foods: [
            {
              fdcId: 9,
              description: 'Egg, whole, raw',
              dataType: 'Foundation',
              foodNutrients: [{ nutrient: { id: 1008, unitName: 'KCAL' }, amount: 143 }],
              foodPortions: [{ gramWeight: 50, amount: 1, portionDescription: 'large' }],
            },
          ],
        }),
      );

    const provider = new UsdaFdcProvider({
      apiKey: 'test-key',
      fetchImpl,
      maxRetries: 2,
      backoffMs: 1,
      maxBackoffMs: 5,
    });
    const match = await provider.search({ query: 'egg' });

    expect(match?.fdcId).toBe('9');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
