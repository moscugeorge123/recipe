import { createPantryItems, listPantryItems } from '@/features/pantry/api';
import {
  listRecipes,
  putRecipeFavorite,
  putRecipeReviewState,
  listRecipeNotes,
  createRecipeNote,
} from '@/features/recipes/api';
import {
  isDefaultPantrySeed,
  type InboxStatus,
  type KitchenCollection,
  type RecipeNote,
} from '@/stores/contracts';
import type { RecipeId } from '@/features/recipes/types';

import {
  DEMO_COLLECTION_IDS,
  isMigratableRecipeId,
  isSeedRecipeId,
} from '@/features/kitchen/ids';
import {
  PENDING_SYNC_SCHEMA_VERSION,
  type CollectionUpsertOp,
  type PendingSyncOp,
  upsertPendingOp,
} from '@/features/kitchen/pending-sync';

export const KITCHEN_MIGRATION_VERSION = 1;
export const KITCHEN_MIGRATION_STORAGE_KEY = 'mise.kitchen.migration.v1';

export type MigrationGroupId =
  'favorites' | 'review' | 'notes' | 'pantry' | 'collections';

export type MigrationGroupResult = {
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  attempted: number;
  confirmed: number;
  skippedSeed: number;
  confirmedKeys: string[];
};

export type KitchenMigrationDocument = {
  version: number;
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  startedAt: number | null;
  completedAt: number | null;
  error?: string;
  groups: Record<MigrationGroupId, MigrationGroupResult>;
};

export type LocalKitchenSnapshot = {
  inboxStatus: Record<RecipeId, InboxStatus>;
  savedIds: RecipeId[];
  cookedCounts: Record<RecipeId, number>;
  recipeNotes: Record<RecipeId, RecipeNote[]>;
  collections: KitchenCollection[];
  pantryStaples: string[];
};

export type KitchenMigrationDeps = {
  listRecipes: typeof listRecipes;
  listPantryItems: typeof listPantryItems;
  listRecipeNotes: typeof listRecipeNotes;
  putFavorite: typeof putRecipeFavorite;
  putReviewState: typeof putRecipeReviewState;
  createNote: typeof createRecipeNote;
  createPantryItems: typeof createPantryItems;
  now: () => number;
  readDocument: () => Promise<KitchenMigrationDocument | null>;
  writeDocument: (doc: KitchenMigrationDocument) => Promise<void>;
  enqueueCollection: (op: CollectionUpsertOp) => void;
};

const GROUPS: MigrationGroupId[] = [
  'favorites',
  'review',
  'notes',
  'pantry',
  'collections',
];

function emptyGroup(): MigrationGroupResult {
  return {
    status: 'pending',
    attempted: 0,
    confirmed: 0,
    skippedSeed: 0,
    confirmedKeys: [],
  };
}

export function emptyMigrationDocument(): KitchenMigrationDocument {
  return {
    version: KITCHEN_MIGRATION_VERSION,
    status: 'idle',
    startedAt: null,
    completedAt: null,
    groups: {
      favorites: emptyGroup(),
      review: emptyGroup(),
      notes: emptyGroup(),
      pantry: emptyGroup(),
      collections: emptyGroup(),
    },
  };
}

function isConfirmed(group: MigrationGroupResult, key: string): boolean {
  return group.confirmedKeys.includes(key);
}

function markConfirmed(group: MigrationGroupResult, key: string): void {
  if (!group.confirmedKeys.includes(key)) {
    group.confirmedKeys.push(key);
    group.confirmed += 1;
  }
}

async function persist(
  deps: KitchenMigrationDeps,
  doc: KitchenMigrationDocument,
): Promise<void> {
  await deps.writeDocument({ ...doc, groups: { ...doc.groups } });
}

async function knownRecipeIds(
  deps: KitchenMigrationDeps,
): Promise<Set<string>> {
  const listed = await deps.listRecipes({ page: 1, pageSize: 100 });
  return new Set(listed.items.map((item) => item.id));
}

function snapshotNeedsOwnedIds(snapshot: LocalKitchenSnapshot): boolean {
  if (snapshot.savedIds.some(isMigratableRecipeId)) {
    return true;
  }
  if (Object.keys(snapshot.inboxStatus).some(isMigratableRecipeId)) {
    return true;
  }
  if (Object.keys(snapshot.recipeNotes).some(isMigratableRecipeId)) {
    return true;
  }
  return snapshot.collections.some((collection) =>
    collection.recipeIds.some(isMigratableRecipeId),
  );
}

export async function runKitchenMigration(
  snapshot: LocalKitchenSnapshot,
  deps: KitchenMigrationDeps,
): Promise<KitchenMigrationDocument> {
  const existing = await deps.readDocument();
  if (
    existing &&
    existing.version >= KITCHEN_MIGRATION_VERSION &&
    existing.status === 'completed'
  ) {
    return existing;
  }

  const doc = existing ?? emptyMigrationDocument();
  doc.version = KITCHEN_MIGRATION_VERSION;
  doc.status = 'in_progress';
  doc.startedAt = doc.startedAt ?? deps.now();
  doc.error = undefined;
  await persist(deps, doc);

  try {
    const ownedIds = snapshotNeedsOwnedIds(snapshot)
      ? await knownRecipeIds(deps)
      : new Set<string>();

    await migrateFavorites(snapshot, ownedIds, doc, deps);
    await migrateReview(snapshot, ownedIds, doc, deps);
    await migrateNotes(snapshot, ownedIds, doc, deps);
    await migratePantry(snapshot, doc, deps);
    await migrateCollections(snapshot, ownedIds, doc, deps);

    const unfinished = GROUPS.some(
      (group) =>
        doc.groups[group].status !== 'completed' &&
        doc.groups[group].status !== 'skipped',
    );
    doc.status = unfinished ? 'in_progress' : 'completed';
    doc.completedAt = unfinished ? null : deps.now();
    await persist(deps, doc);
    return doc;
  } catch (error) {
    doc.status = 'failed';
    doc.error =
      error instanceof Error
        ? error.message
        : 'Kitchen upgrade did not finish.';
    await persist(deps, doc);
    return doc;
  }
}

async function migrateFavorites(
  snapshot: LocalKitchenSnapshot,
  ownedIds: Set<string>,
  doc: KitchenMigrationDocument,
  deps: KitchenMigrationDeps,
): Promise<void> {
  const group = doc.groups.favorites;
  if (group.status === 'completed') {
    return;
  }
  group.status = 'in_progress';
  group.skippedSeed = snapshot.savedIds.filter(isSeedRecipeId).length;
  const targets = snapshot.savedIds.filter(
    (id) => isMigratableRecipeId(id) && ownedIds.has(id),
  );
  group.attempted = targets.length;
  await persist(deps, doc);

  for (const id of targets) {
    const key = `favorite:${id}`;
    if (isConfirmed(group, key)) {
      continue;
    }
    await deps.putFavorite(id);
    markConfirmed(group, key);
    await persist(deps, doc);
  }
  group.status = 'completed';
  await persist(deps, doc);
}

async function migrateReview(
  snapshot: LocalKitchenSnapshot,
  ownedIds: Set<string>,
  doc: KitchenMigrationDocument,
  deps: KitchenMigrationDeps,
): Promise<void> {
  const group = doc.groups.review;
  if (group.status === 'completed') {
    return;
  }
  group.status = 'in_progress';
  const seedInbox = Object.keys(snapshot.inboxStatus).filter(isSeedRecipeId);
  group.skippedSeed = seedInbox.length;

  const readyIds = [
    ...new Set([
      ...snapshot.savedIds.filter(
        (id) => isMigratableRecipeId(id) && !snapshot.inboxStatus[id],
      ),
      ...Object.entries(snapshot.inboxStatus)
        .filter(
          ([id, status]) => isMigratableRecipeId(id) && status === 'ready',
        )
        .map(([id]) => id),
    ]),
  ].filter((id) => ownedIds.has(id));

  group.attempted = readyIds.length;
  await persist(deps, doc);

  for (const id of readyIds) {
    const key = `review:${id}`;
    if (isConfirmed(group, key)) {
      continue;
    }
    await deps.putReviewState(id, 'READY');
    markConfirmed(group, key);
    await persist(deps, doc);
  }
  group.status = 'completed';
  await persist(deps, doc);
}

async function migrateNotes(
  snapshot: LocalKitchenSnapshot,
  ownedIds: Set<string>,
  doc: KitchenMigrationDocument,
  deps: KitchenMigrationDeps,
): Promise<void> {
  const group = doc.groups.notes;
  if (group.status === 'completed') {
    return;
  }
  group.status = 'in_progress';
  const entries = Object.entries(snapshot.recipeNotes);
  group.skippedSeed = entries
    .filter(([id]) => isSeedRecipeId(id))
    .reduce((sum, [, notes]) => sum + notes.length, 0);

  const targets = entries.filter(
    ([id]) => isMigratableRecipeId(id) && ownedIds.has(id),
  );
  group.attempted = targets.reduce((sum, [, notes]) => sum + notes.length, 0);
  await persist(deps, doc);

  for (const [recipeId, notes] of targets) {
    const existing = await deps.listRecipeNotes(recipeId);
    const bodies = new Set(existing.map((note) => note.body.trim()));
    for (const note of notes) {
      const body = note.text.trim();
      if (!body) {
        continue;
      }
      const key = `note:${recipeId}:${note.cookedAt}:${body}`;
      if (isConfirmed(group, key)) {
        continue;
      }
      if (bodies.has(body)) {
        markConfirmed(group, key);
        await persist(deps, doc);
        continue;
      }
      await deps.createNote(recipeId, { body });
      bodies.add(body);
      markConfirmed(group, key);
      await persist(deps, doc);
    }
  }
  group.status = 'completed';
  await persist(deps, doc);
}

export function userPantryStaples(staples: readonly string[]): string[] {
  const names = [
    ...new Set(
      staples.map((name) => name.trim()).filter((name) => name.length > 0),
    ),
  ];
  if (isDefaultPantrySeed(names)) return [];
  return names;
}

export function untouchedPantrySeedIds(
  items: { id: string; name: string; canonicalName?: string | null }[],
  total = items.length,
): string[] | null {
  if (total !== items.length) return null;
  const names = items.map((item) =>
    (item.canonicalName ?? item.name).trim().toLowerCase(),
  );
  if (!isDefaultPantrySeed(names)) return null;
  return items.map((item) => item.id);
}

/** Deletes the built-in staple rows once, and only when the pantry is exactly that list. */
export async function clearUntouchedPantrySeed(deps: {
  alreadyCleared: boolean;
  list: () => Promise<{
    items: { id: string; name: string; canonicalName?: string | null }[];
    meta: { total: number };
  }>;
  remove: (id: string) => Promise<unknown>;
  markCleared: () => void;
}): Promise<boolean> {
  if (deps.alreadyCleared) return false;
  const listed = await deps.list();
  const ids = untouchedPantrySeedIds(listed.items, listed.meta.total);
  if (!ids) {
    deps.markCleared();
    return false;
  }
  await Promise.all(ids.map((id) => deps.remove(id)));
  deps.markCleared();
  return true;
}

async function migratePantry(
  snapshot: LocalKitchenSnapshot,
  doc: KitchenMigrationDocument,
  deps: KitchenMigrationDeps,
): Promise<void> {
  const group = doc.groups.pantry;
  if (group.status === 'completed') {
    return;
  }
  group.status = 'in_progress';
  const names = userPantryStaples(snapshot.pantryStaples);
  group.attempted = names.length;
  group.skippedSeed = 0;
  await persist(deps, doc);

  if (names.length === 0) {
    group.status = 'completed';
    await persist(deps, doc);
    return;
  }

  const listed = await deps.listPantryItems({ page: 1, pageSize: 100 });
  const have = new Set(
    listed.items.flatMap((item) =>
      [item.canonicalName, item.name]
        .filter((value): value is string => !!value)
        .map((value) => value.trim().toLowerCase()),
    ),
  );

  for (const name of names) {
    const key = `pantry:${name.toLowerCase()}`;
    if (isConfirmed(group, key)) {
      continue;
    }
    if (have.has(name.toLowerCase())) {
      markConfirmed(group, key);
      await persist(deps, doc);
      continue;
    }
    await deps.createPantryItems([{ name }]);
    have.add(name.toLowerCase());
    markConfirmed(group, key);
    await persist(deps, doc);
  }
  group.status = 'completed';
  await persist(deps, doc);
}

async function migrateCollections(
  snapshot: LocalKitchenSnapshot,
  ownedIds: Set<string>,
  doc: KitchenMigrationDocument,
  deps: KitchenMigrationDeps,
): Promise<void> {
  const group = doc.groups.collections;
  if (group.status === 'completed') {
    return;
  }
  group.status = 'in_progress';
  let skippedSeed = 0;
  const queued: KitchenCollection[] = [];

  for (const collection of snapshot.collections) {
    const seedCount = collection.recipeIds.filter(isSeedRecipeId).length;
    skippedSeed += seedCount;
    const recipeIds = collection.recipeIds.filter(
      (id) => isMigratableRecipeId(id) && ownedIds.has(id),
    );
    const isDemo =
      (DEMO_COLLECTION_IDS as readonly string[]).includes(collection.id) &&
      recipeIds.length === 0;
    if (isDemo) {
      continue;
    }
    queued.push({ ...collection, recipeIds });
  }

  group.skippedSeed = skippedSeed;
  group.attempted = queued.length;
  await persist(deps, doc);

  for (const collection of queued) {
    const key = `collection:${collection.id}`;
    if (isConfirmed(group, key)) {
      continue;
    }
    const op: CollectionUpsertOp = {
      id: `ps-col-${collection.id}`,
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind: 'collection.upsert',
      status: 'pending',
      attempts: 0,
      createdAt: deps.now(),
      payload: {
        clientId: collection.id,
        name: collection.name,
        recipeIds: collection.recipeIds,
        createdAt: deps.now(),
      },
    };
    deps.enqueueCollection(op);
    markConfirmed(group, key);
    await persist(deps, doc);
  }
  group.status = 'completed';
  await persist(deps, doc);
}

export function defaultKitchenMigrationDeps(
  enqueueCollection: (op: CollectionUpsertOp) => void,
  storage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  },
): KitchenMigrationDeps {
  return {
    listRecipes,
    listPantryItems,
    listRecipeNotes,
    putFavorite: putRecipeFavorite,
    putReviewState: putRecipeReviewState,
    createNote: createRecipeNote,
    createPantryItems,
    now: () => Date.now(),
    enqueueCollection,
    readDocument: async () => {
      const raw = await storage.getItem(KITCHEN_MIGRATION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      try {
        return JSON.parse(raw) as KitchenMigrationDocument;
      } catch {
        return null;
      }
    },
    writeDocument: async (doc) => {
      await storage.setItem(KITCHEN_MIGRATION_STORAGE_KEY, JSON.stringify(doc));
    },
  };
}

export function leftoverAfterMigration(
  snapshot: LocalKitchenSnapshot,
  doc: KitchenMigrationDocument,
): Partial<LocalKitchenSnapshot> {
  const keepSeeds = <T extends string>(ids: T[]) => ids.filter(isSeedRecipeId);
  const keepSeedRecord = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      Object.entries(record).filter(([id]) => isSeedRecipeId(id)),
    ) as Record<string, T>;

  return {
    savedIds:
      doc.groups.favorites.status === 'completed'
        ? keepSeeds(snapshot.savedIds)
        : snapshot.savedIds,
    inboxStatus:
      doc.groups.review.status === 'completed'
        ? keepSeedRecord(snapshot.inboxStatus)
        : snapshot.inboxStatus,
    recipeNotes:
      doc.groups.notes.status === 'completed'
        ? keepSeedRecord(snapshot.recipeNotes)
        : snapshot.recipeNotes,
    pantryStaples:
      doc.groups.pantry.status === 'completed' ? [] : snapshot.pantryStaples,
    collections:
      doc.groups.collections.status === 'completed' ? [] : snapshot.collections,
    cookedCounts: keepSeedRecord(snapshot.cookedCounts),
  };
}

/** @internal coalescing helper exported for tests */
export function mergePending(queue: PendingSyncOp[], op: PendingSyncOp) {
  return upsertPendingOp(queue, op);
}
