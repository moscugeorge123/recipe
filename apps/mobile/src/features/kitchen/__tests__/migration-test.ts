import {
  emptyMigrationDocument,
  leftoverAfterMigration,
  runKitchenMigration,
  type KitchenMigrationDeps,
  type LocalKitchenSnapshot,
} from '@/features/kitchen/migration';
import type { CollectionUpsertOp } from '@/features/kitchen/pending-sync';

const API_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function snapshot(
  overrides: Partial<LocalKitchenSnapshot> = {},
): LocalKitchenSnapshot {
  return {
    inboxStatus: {
      'seed:galette': 'needs_review',
      [API_ID]: 'ready',
    },
    savedIds: ['seed:harissa', API_ID],
    cookedCounts: { 'seed:dal': 2, [API_ID]: 4 },
    recipeNotes: {
      'seed:dal': [{ text: 'seed note', cookedAt: 1 }],
      [API_ID]: [{ text: 'more heat', cookedAt: 2 }],
    },
    collections: [
      {
        id: 'sunday',
        name: 'Sunday cooking',
        recipeIds: ['seed:galette', API_ID],
      },
      {
        id: 'col-custom',
        name: 'Weeknights',
        recipeIds: [API_ID, 'seed:dal'],
      },
    ],
    pantryStaples: ['olive oil', 'za’atar'],
    ...overrides,
  };
}

function deps(
  overrides: Partial<KitchenMigrationDeps> & {
    crashAfter?: string;
  } = {},
): KitchenMigrationDeps & { queued: CollectionUpsertOp[]; docs: unknown[] } {
  let store: string | null = null;
  const queued: CollectionUpsertOp[] = [];
  const docs: unknown[] = [];
  const crashAfter = overrides.crashAfter;
  const base: KitchenMigrationDeps = {
    listRecipes: async () => ({
      items: [{ id: API_ID }, { id: OTHER_ID }] as never,
      meta: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    }),
    listPantryItems: async () => ({
      items: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    }),
    listRecipeNotes: async () => [],
    putFavorite: async () => ({ id: API_ID }) as never,
    putReviewState: async () => ({ id: API_ID }) as never,
    createNote: async () => ({ id: 'n1', body: 'more heat' }) as never,
    createPantryItems: async () => [{ id: 'p1' }] as never,
    now: () => 1,
    enqueueCollection: (op) => {
      queued.push(op);
    },
    readDocument: async () => (store ? JSON.parse(store) : null),
    writeDocument: async (doc) => {
      const serialized = JSON.stringify(doc);
      docs.push(JSON.parse(serialized));
      if (
        crashAfter &&
        serialized.includes(crashAfter) &&
        !store?.includes(crashAfter)
      ) {
        store = serialized;
        throw new Error('crash');
      }
      store = serialized;
    },
  };
  return { ...base, ...overrides, queued, docs };
}

describe('kitchen migration', () => {
  test('ignores seed ids and uploads API-backed kitchen data once', async () => {
    const calls = {
      favorite: [] as string[],
      review: [] as string[],
      notes: [] as string[],
      pantry: [] as string[],
    };
    const harness = deps({
      putFavorite: async (id) => {
        calls.favorite.push(id);
        return { id } as never;
      },
      putReviewState: async (id) => {
        calls.review.push(id);
        return { id } as never;
      },
      createNote: async (id, input) => {
        calls.notes.push(`${id}:${input.body}`);
        return { id: 'n1', body: input.body } as never;
      },
      createPantryItems: async (items) => {
        calls.pantry.push(items[0]?.name ?? '');
        return [{ id: 'p1' }] as never;
      },
    });

    const first = await runKitchenMigration(snapshot(), harness);
    expect(first.status).toBe('completed');
    expect(first.version).toBe(1);
    expect(calls.favorite).toEqual([API_ID]);
    expect(calls.review).toEqual([API_ID]);
    expect(calls.notes).toEqual([`${API_ID}:more heat`]);
    expect(calls.pantry).toEqual(['olive oil', 'za’atar']);
    expect(harness.queued).toHaveLength(2);
    expect(harness.queued.map((item) => item.payload.clientId).sort()).toEqual([
      'col-custom',
      'sunday',
    ]);
    expect(
      harness.queued.every((item) =>
        item.payload.recipeIds.every((id) => id === API_ID),
      ),
    ).toBe(true);

    const second = await runKitchenMigration(snapshot(), harness);
    expect(second.status).toBe('completed');
    expect(calls.favorite).toHaveLength(1);
    expect(calls.notes).toHaveLength(1);
  });

  test('resumes after crash without duplicating confirmed notes or favorites', async () => {
    const notes: string[] = [];
    const favorites: string[] = [];
    const harness = deps({
      crashAfter: 'note:',
      putFavorite: async (id) => {
        favorites.push(id);
        return { id } as never;
      },
      createNote: async (id, input) => {
        notes.push(`${id}:${input.body}`);
        return { id: 'n1', body: input.body } as never;
      },
    });

    const crashed = await runKitchenMigration(snapshot(), harness);
    expect(crashed.status).toBe('failed');
    expect(favorites).toEqual([API_ID]);
    expect(notes.length).toBeGreaterThanOrEqual(0);

    const resumed = deps({
      readDocument: harness.readDocument,
      writeDocument: harness.writeDocument,
      putFavorite: async (id) => {
        favorites.push(id);
        return { id } as never;
      },
      createNote: async (id, input) => {
        notes.push(`${id}:${input.body}`);
        return { id: 'n1', body: input.body } as never;
      },
      enqueueCollection: harness.enqueueCollection,
    });
    const done = await runKitchenMigration(snapshot(), resumed);
    expect(done.status).toBe('completed');
    expect(favorites.filter((id) => id === API_ID)).toHaveLength(1);
    expect(notes.filter((item) => item === `${API_ID}:more heat`)).toHaveLength(
      1,
    );
  });

  test('empty leftover kitchen completes without recipe or pantry fetches', async () => {
    let recipes = 0;
    let pantry = 0;
    const harness = deps({
      listRecipes: async () => {
        recipes += 1;
        return {
          items: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        } as never;
      },
      listPantryItems: async () => {
        pantry += 1;
        return {
          items: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        };
      },
    });
    const doc = await runKitchenMigration(
      snapshot({
        inboxStatus: {},
        savedIds: [],
        cookedCounts: {},
        recipeNotes: {},
        collections: [],
        pantryStaples: [],
      }),
      harness,
    );
    expect(doc.status).toBe('completed');
    expect(recipes).toBe(0);
    expect(pantry).toBe(0);
  });

  test('skips notes the server already has', async () => {
    const created: string[] = [];
    const harness = deps({
      listRecipeNotes: async () =>
        [{ id: 'n-existing', body: 'more heat' }] as never,
      createNote: async (_id, input) => {
        created.push(input.body);
        return { id: 'n2', body: input.body } as never;
      },
    });
    await runKitchenMigration(snapshot(), harness);
    expect(created).toEqual([]);
  });

  test('clears migrated leftovers but keeps seed overlays', () => {
    const leftovers = leftoverAfterMigration(snapshot(), {
      ...emptyMigrationDocument(),
      status: 'completed',
      groups: {
        favorites: {
          status: 'completed',
          attempted: 1,
          confirmed: 1,
          skippedSeed: 1,
          confirmedKeys: [`favorite:${API_ID}`],
        },
        review: {
          status: 'completed',
          attempted: 1,
          confirmed: 1,
          skippedSeed: 1,
          confirmedKeys: [`review:${API_ID}`],
        },
        notes: {
          status: 'completed',
          attempted: 1,
          confirmed: 1,
          skippedSeed: 1,
          confirmedKeys: [`note:${API_ID}:2:more heat`],
        },
        pantry: {
          status: 'completed',
          attempted: 2,
          confirmed: 2,
          skippedSeed: 0,
          confirmedKeys: ['pantry:olive oil', 'pantry:za’atar'],
        },
        collections: {
          status: 'completed',
          attempted: 2,
          confirmed: 2,
          skippedSeed: 3,
          confirmedKeys: ['collection:sunday', 'collection:col-custom'],
        },
      },
    });
    expect(leftovers.savedIds).toEqual(['seed:harissa']);
    expect(leftovers.inboxStatus).toEqual({ 'seed:galette': 'needs_review' });
    expect(leftovers.recipeNotes?.['seed:dal']?.[0]?.text).toBe('seed note');
    expect(leftovers.pantryStaples).toEqual([]);
    expect(leftovers.collections).toEqual([]);
    expect(leftovers.cookedCounts).toEqual({ 'seed:dal': 2 });
  });
});
