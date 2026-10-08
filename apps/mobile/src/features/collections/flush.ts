import { ApiError } from '@/services/api-client';
import type { CollectionUpsertOp } from '@/features/kitchen/pending-sync';
import {
  addCollectionRecipe,
  createCollection,
  listCollections,
} from '@/features/collections/api';
import type { CollectionSummary } from '@/features/collections/types';

function namesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isNameConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 || error.code === 'COLLECTION_NAME_CONFLICT')
  );
}

function isIgnorableMembership(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 ||
      error.status === 409 ||
      error.code === 'RECIPE_NOT_FOUND' ||
      error.code === 'COLLECTION_RECIPE_CONFLICT')
  );
}

async function findByName(name: string): Promise<CollectionSummary | null> {
  const listed = await listCollections({ page: 1, pageSize: 100 });
  return listed.items.find((item) => namesMatch(item.name, name)) ?? null;
}

/**
 * Idempotent Agent 6 leftover flush: reuse a same-name collection, then
 * add memberships. Duplicate names and duplicate memberships are success.
 */
export async function flushCollectionUpsert(
  op: CollectionUpsertOp,
): Promise<CollectionSummary> {
  const name = op.payload.name.trim();
  let collection = await findByName(name);

  if (!collection) {
    try {
      collection = await createCollection({ name });
    } catch (error) {
      if (!isNameConflict(error)) {
        throw error;
      }
      collection = await findByName(name);
    }
  }

  if (!collection) {
    throw new Error(`Could not upsert collection “${name}”`);
  }

  for (const recipeId of op.payload.recipeIds) {
    try {
      collection = await addCollectionRecipe(collection.id, recipeId);
    } catch (error) {
      if (isIgnorableMembership(error)) {
        continue;
      }
      throw error;
    }
  }

  return collection;
}
