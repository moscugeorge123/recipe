import {
  AUTO_FLUSH_KINDS,
  PENDING_SYNC_SCHEMA_VERSION,
  coalesceKey,
  collectionsFromQueue,
  pendingAutoFlush,
  upsertPendingOp,
  type PendingSyncOp,
} from '@/features/kitchen/pending-sync';
import {
  collectionKeys,
  cookSessionKeys,
  pantryKeys,
  profileKeys,
  recipeKeys,
} from '@/features/query-keys';

function favorite(kind: 'favorite.put' | 'favorite.delete'): PendingSyncOp {
  return {
    id: `ps-${kind}-r1`,
    schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
    kind,
    status: 'pending',
    attempts: 0,
    createdAt: 1,
    payload: { recipeId: '11111111-1111-4111-8111-111111111111' },
  };
}

describe('pending-sync queue', () => {
  test('coalesces competing favorite writes for the same recipe', () => {
    const queued = upsertPendingOp(
      upsertPendingOp([], favorite('favorite.put')),
      favorite('favorite.delete'),
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]?.kind).toBe('favorite.delete');
    expect(coalesceKey(queued[0]!)).toBe(
      'favorite:11111111-1111-4111-8111-111111111111',
    );
  });

  test('auto-flushes collection.upsert now that collection APIs exist', () => {
    const collection: PendingSyncOp = {
      id: 'ps-col-1',
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind: 'collection.upsert',
      status: 'pending',
      attempts: 0,
      createdAt: 1,
      payload: {
        clientId: 'col-1',
        name: 'Weeknights',
        recipeIds: ['11111111-1111-4111-8111-111111111111'],
        createdAt: 1,
      },
    };
    expect(AUTO_FLUSH_KINDS.has('collection.upsert')).toBe(true);
    expect(pendingAutoFlush([collection, favorite('favorite.put')])).toEqual([
      collection,
      favorite('favorite.put'),
    ]);
    expect(collectionsFromQueue([collection])).toEqual([collection.payload]);
  });
});

describe('query key map', () => {
  test('keeps existing recipe/pantry/cook prefixes stable', () => {
    expect(recipeKeys.list(1, 8, { sort: 'latest' })).toEqual([
      'recipes',
      1,
      8,
      { sort: 'latest' },
    ]);
    expect(recipeKeys.notes('recipe-1')).toEqual([
      'recipes',
      'detail',
      'recipe-1',
      'notes',
    ]);
    expect(pantryKeys.list()).toEqual(['pantry', 'list', 'all']);
    expect(cookSessionKeys.current).toEqual(['cook-sessions', 'current']);
    expect(collectionKeys.list).toEqual(['collections', 'list']);
    expect(profileKeys.current).toEqual(['profile', 'current']);
  });
});
