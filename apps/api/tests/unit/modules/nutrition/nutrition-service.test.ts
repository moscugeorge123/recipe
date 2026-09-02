import { describe, expect, it, vi } from 'vitest';

import { InMemoryQueueProvider } from '../../../../src/infrastructure/queues/bullmq/bullmq-queue-provider.js';
import type {
  INutritionRepository,
  NutritionSnapshotRecord,
} from '../../../../src/infrastructure/database/repositories/nutrition.repository.js';
import { NutritionCalculator } from '../../../../src/modules/nutrition/application/nutrition-calculator.js';
import { InMemoryNutritionCache } from '../../../../src/modules/nutrition/application/memory-nutrition-cache.js';
import {
  NUTRITION_JOB_NAME,
  NutritionService,
} from '../../../../src/modules/nutrition/application/nutrition-service.js';
import { FakeNutritionProvider } from '../../../../src/modules/nutrition/providers/fake/fake-nutrition-provider.js';
import { NutritionRateLimitError } from '../../../../src/modules/nutrition/domain/types.js';
import type { IRecipeRepository } from '../../../../src/modules/recipes/repository/recipe.repository.js';

const REVISION_ID = '44444444-4444-4444-8444-444444444444';
const SNAPSHOT_ID = '99999999-9999-4999-8999-999999999999';
const RECIPE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '00000000-0000-4000-8000-000000000001';

function snapshot(overrides: Partial<NutritionSnapshotRecord> = {}): NutritionSnapshotRecord {
  return {
    id: SNAPSHOT_ID,
    recipeRevisionId: REVISION_ID,
    status: 'PENDING',
    servings: 2,
    wholeRecipe: null,
    perServing: null,
    per100g: null,
    coveragePercent: null,
    unmatchedIngredients: [],
    provider: null,
    calculatedAt: null,
    totalGrams: null,
    failureReason: null,
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    updatedAt: new Date('2026-08-31T00:00:00.000Z'),
    matches: [],
    ...overrides,
  };
}

describe('NutritionService queue processing', () => {
  it('enqueues a pending snapshot and completes it from the processor', async () => {
    const created = snapshot();
    const completed = snapshot({
      status: 'COMPLETED',
      wholeRecipe: { calories: 742 },
      perServing: { calories: 371 },
      per100g: { calories: 371 },
      coveragePercent: 100,
      provider: 'fake',
      calculatedAt: new Date('2026-08-31T00:01:00.000Z'),
    });
    const createSnapshot = vi.fn().mockResolvedValue(created);
    const completeSnapshot = vi.fn().mockResolvedValue(completed);
    const nutritionRepo: INutritionRepository = {
      createSnapshot,
      findSnapshotById: vi.fn().mockResolvedValue(created),
      listSnapshotsForRevision: vi.fn().mockResolvedValue([]),
      updateSnapshotStatus: vi.fn().mockResolvedValue(undefined),
      completeSnapshot,
      findQueryCache: vi.fn().mockResolvedValue(null),
      upsertQueryCache: vi.fn().mockResolvedValue(undefined),
      findFoodCache: vi.fn().mockResolvedValue(null),
      upsertFoodCache: vi.fn().mockResolvedValue(undefined),
      findRevisionIngredients: vi.fn().mockResolvedValue([
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Pasta',
          canonicalName: 'pasta',
          quantity: 200,
          unit: 'g',
        },
      ]),
      findRevisionMeta: vi.fn().mockResolvedValue({
        id: REVISION_ID,
        servings: 2,
        userId: USER_ID,
        recipeId: RECIPE_ID,
      }),
    };
    const recipeRepo = {
      findEffectiveById: vi.fn(),
    } as unknown as IRecipeRepository;
    const queue = new InMemoryQueueProvider();
    const calculator = new NutritionCalculator(new FakeNutritionProvider(), new InMemoryNutritionCache());
    const service = new NutritionService(recipeRepo, nutritionRepo, calculator, queue);
    queue.registerProcessor(NUTRITION_JOB_NAME, async (payload) => {
      await service.processSnapshot(payload.jobId);
    });

    await service.requestForRevision({ recipeId: RECIPE_ID, revisionId: REVISION_ID, userId: USER_ID });

    expect(createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ recipeRevisionId: REVISION_ID, status: 'PENDING' }),
    );
    expect(completeSnapshot).toHaveBeenCalledWith(
      SNAPSHOT_ID,
      expect.objectContaining({ status: 'COMPLETED', provider: 'fake' }),
    );
  });

  it('rethrows 429 so BullMQ can retry and leaves the snapshot pending', async () => {
    const updateSnapshotStatus = vi.fn().mockResolvedValue(undefined);
    const completeSnapshot = vi.fn();
    const nutritionRepo: INutritionRepository = {
      createSnapshot: vi.fn(),
      findSnapshotById: vi.fn().mockResolvedValue(snapshot({ status: 'PENDING' })),
      listSnapshotsForRevision: vi.fn(),
      updateSnapshotStatus,
      completeSnapshot,
      findQueryCache: vi.fn(),
      upsertQueryCache: vi.fn(),
      findFoodCache: vi.fn(),
      upsertFoodCache: vi.fn(),
      findRevisionIngredients: vi.fn().mockResolvedValue([
        { id: '1', name: 'Pasta', canonicalName: 'pasta', quantity: 200, unit: 'g' },
      ]),
      findRevisionMeta: vi.fn().mockResolvedValue({
        id: REVISION_ID,
        servings: 2,
        userId: USER_ID,
        recipeId: RECIPE_ID,
      }),
    };
    const calculator = {
      calculate: vi.fn(async () => {
        throw new NutritionRateLimitError();
      }),
    } as unknown as NutritionCalculator;
    const service = new NutritionService(
      {} as IRecipeRepository,
      nutritionRepo,
      calculator,
      new InMemoryQueueProvider(),
    );

    await expect(service.processSnapshot(SNAPSHOT_ID)).rejects.toBeInstanceOf(NutritionRateLimitError);
    expect(updateSnapshotStatus).toHaveBeenCalledWith(SNAPSHOT_ID, 'PENDING');
    expect(completeSnapshot).not.toHaveBeenCalled();
  });
});
