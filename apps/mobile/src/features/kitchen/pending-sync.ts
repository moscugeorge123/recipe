/**
 * Pending-sync queue schema v1.
 *
 * Safe to auto-flush (idempotent):
 * - `favorite.put` / `favorite.delete` → PUT/DELETE `/recipes/:id/favorite`
 * - `review.ready` / `review.needs_review` → PUT `/recipes/:id/review-state`
 * - `pantry.upsert` → POST `/pantry/items` (canonical-name upsert)
 * - `collection.upsert` → POST `/collections` then membership (name + recipe add)
 *
 * Never queue (destructive / not safely replayable):
 * - note create/update (use durable drafts instead)
 * - pantry / note / recipe DELETE (require an explicit confirm, then a live
 *   request — do not replay)
 */
export const PENDING_SYNC_SCHEMA_VERSION = 1;

export type PendingSyncStatus = 'pending' | 'confirmed' | 'failed';

type PendingSyncBase = {
  id: string;
  schemaVersion: typeof PENDING_SYNC_SCHEMA_VERSION;
  status: PendingSyncStatus;
  attempts: number;
  createdAt: number;
  lastError?: string;
};

export type CollectionUpsertOp = PendingSyncBase & {
  kind: 'collection.upsert';
  payload: {
    /** Local collection id (`col-*` or a surviving custom id). */
    clientId: string;
    name: string;
    /** API UUID recipe ids only. Seed ids are stripped before enqueue. */
    recipeIds: string[];
    createdAt: number;
  };
};

export type FavoritePutOp = PendingSyncBase & {
  kind: 'favorite.put' | 'favorite.delete';
  payload: { recipeId: string };
};

export type ReviewStateOp = PendingSyncBase & {
  kind: 'review.ready' | 'review.needs_review';
  payload: { recipeId: string };
};

export type PantryUpsertOp = PendingSyncBase & {
  kind: 'pantry.upsert';
  payload: { name: string };
};

export type PendingSyncOp =
  CollectionUpsertOp | FavoritePutOp | ReviewStateOp | PantryUpsertOp;

export const AUTO_FLUSH_KINDS: ReadonlySet<PendingSyncOp['kind']> = new Set([
  'favorite.put',
  'favorite.delete',
  'review.ready',
  'review.needs_review',
  'pantry.upsert',
  'collection.upsert',
]);

export function coalesceKey(op: PendingSyncOp): string {
  switch (op.kind) {
    case 'collection.upsert':
      return `collection.upsert:${op.payload.clientId}`;
    case 'favorite.put':
    case 'favorite.delete':
      return `favorite:${op.payload.recipeId}`;
    case 'review.ready':
    case 'review.needs_review':
      return `review:${op.payload.recipeId}`;
    case 'pantry.upsert':
      return `pantry.upsert:${op.payload.name.trim().toLowerCase()}`;
  }
}

export function upsertPendingOp(
  queue: PendingSyncOp[],
  next: PendingSyncOp,
): PendingSyncOp[] {
  const key = coalesceKey(next);
  const without = queue.filter(
    (item) => item.status === 'confirmed' || coalesceKey(item) !== key,
  );
  return [...without, next];
}

export function pendingAutoFlush(queue: PendingSyncOp[]): PendingSyncOp[] {
  return queue.filter(
    (item) => item.status === 'pending' && AUTO_FLUSH_KINDS.has(item.kind),
  );
}

export function collectionsFromQueue(
  queue: PendingSyncOp[],
): CollectionUpsertOp['payload'][] {
  return queue
    .filter(
      (item): item is CollectionUpsertOp =>
        item.kind === 'collection.upsert' && item.status !== 'confirmed',
    )
    .map((item) => item.payload);
}
