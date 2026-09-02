import { PENDING_SYNC_SCHEMA_VERSION } from '@/features/kitchen/pending-sync';
import { flushCollectionUpsert } from '@/features/collections/flush';
import { ApiError } from '@/services/api-client';

const mockListCollections = jest.fn();
const mockCreateCollection = jest.fn();
const mockAddCollectionRecipe = jest.fn();

jest.mock('@/features/collections/api', () => ({
  listCollections: (...args: unknown[]) => mockListCollections(...args),
  createCollection: (...args: unknown[]) => mockCreateCollection(...args),
  addCollectionRecipe: (...args: unknown[]) => mockAddCollectionRecipe(...args),
}));

const recipeId = '11111111-1111-4111-8111-111111111111';
const collectionId = '22222222-2222-4222-8222-222222222222';

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: collectionId,
    name: 'Appetizers',
    description: null,
    recipeCount: 0,
    recipeIds: [] as string[],
    coverPreviews: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('flushCollectionUpsert', () => {
  beforeEach(() => {
    mockListCollections.mockReset();
    mockCreateCollection.mockReset();
    mockAddCollectionRecipe.mockReset();
  });

  test('creates a collection then adds memberships', async () => {
    mockListCollections.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
    mockCreateCollection.mockResolvedValue(summary());
    mockAddCollectionRecipe.mockResolvedValue(
      summary({ recipeIds: [recipeId], recipeCount: 1 }),
    );

    const result = await flushCollectionUpsert({
      id: 'ps-col-1',
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind: 'collection.upsert',
      status: 'pending',
      attempts: 0,
      createdAt: 1,
      payload: {
        clientId: 'col-1',
        name: 'Appetizers',
        recipeIds: [recipeId],
        createdAt: 1,
      },
    });

    expect(mockCreateCollection).toHaveBeenCalledWith({ name: 'Appetizers' });
    expect(mockAddCollectionRecipe).toHaveBeenCalledWith(
      collectionId,
      recipeId,
    );
    expect(result.recipeIds).toEqual([recipeId]);
  });

  test('reuses a same-name collection and treats duplicate membership as success', async () => {
    mockListCollections.mockResolvedValue({
      items: [summary({ recipeIds: [recipeId], recipeCount: 1 })],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    mockAddCollectionRecipe.mockRejectedValue(
      new ApiError('exists', 409, {}, 'COLLECTION_RECIPE_CONFLICT'),
    );

    const result = await flushCollectionUpsert({
      id: 'ps-col-1',
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind: 'collection.upsert',
      status: 'pending',
      attempts: 0,
      createdAt: 1,
      payload: {
        clientId: 'col-1',
        name: 'appetizers',
        recipeIds: [recipeId],
        createdAt: 1,
      },
    });

    expect(mockCreateCollection).not.toHaveBeenCalled();
    expect(mockAddCollectionRecipe).toHaveBeenCalled();
    expect(result.id).toBe(collectionId);
  });

  test('create name conflict still finds the existing collection', async () => {
    mockListCollections
      .mockResolvedValueOnce({
        items: [],
        meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      })
      .mockResolvedValueOnce({
        items: [summary()],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      });
    mockCreateCollection.mockRejectedValue(
      new ApiError('taken', 409, {}, 'COLLECTION_NAME_CONFLICT'),
    );
    mockAddCollectionRecipe.mockResolvedValue(
      summary({ recipeIds: [recipeId] }),
    );

    await flushCollectionUpsert({
      id: 'ps-col-1',
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind: 'collection.upsert',
      status: 'pending',
      attempts: 0,
      createdAt: 1,
      payload: {
        clientId: 'col-1',
        name: 'Appetizers',
        recipeIds: [recipeId],
        createdAt: 1,
      },
    });

    expect(mockListCollections).toHaveBeenCalledTimes(2);
    expect(mockAddCollectionRecipe).toHaveBeenCalledWith(
      collectionId,
      recipeId,
    );
  });
});
