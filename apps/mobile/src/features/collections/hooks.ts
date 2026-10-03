import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  addCollectionRecipe,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  removeCollectionRecipe,
  renameCollection,
  reorderCollectionRecipes,
} from '@/features/collections/api';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/features/collections/types';
import { QUERY_FRESHNESS, collectionKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';

export { collectionKeys } from '@/features/query-keys';

export type CollectionsListPage = {
  items: CollectionSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  fromCache?: boolean;
};

function patchListItem(
  page: CollectionsListPage | undefined,
  collectionId: string,
  update: (item: CollectionSummary) => CollectionSummary,
): CollectionsListPage | undefined {
  if (!page) {
    return page;
  }
  return {
    ...page,
    items: page.items.map((item) =>
      item.id === collectionId ? update(item) : item,
    ),
  };
}

function withRecipe(
  item: CollectionSummary,
  recipeId: string,
): CollectionSummary {
  if (item.recipeIds.includes(recipeId)) {
    return item;
  }
  return {
    ...item,
    recipeIds: [...item.recipeIds, recipeId],
    recipeCount: item.recipeCount + 1,
  };
}

function withoutRecipe(
  item: CollectionSummary,
  recipeId: string,
): CollectionSummary {
  if (!item.recipeIds.includes(recipeId)) {
    return item;
  }
  return {
    ...item,
    recipeIds: item.recipeIds.filter((id) => id !== recipeId),
    recipeCount: Math.max(0, item.recipeCount - 1),
    coverPreviews: item.coverPreviews.filter(
      (cover) => cover.recipeId !== recipeId,
    ),
  };
}

async function snapshotCollections(
  client: QueryClient,
  collectionId?: string,
): Promise<{
  list?: CollectionsListPage;
  detail?: CollectionDetail;
}> {
  await client.cancelQueries({ queryKey: collectionKeys.all });
  return {
    list: client.getQueryData<CollectionsListPage>(collectionKeys.list),
    detail: collectionId
      ? client.getQueryData<CollectionDetail>(
          collectionKeys.detail(collectionId),
        )
      : undefined,
  };
}

function restoreCollections(
  client: QueryClient,
  collectionId: string | undefined,
  snapshot: { list?: CollectionsListPage; detail?: CollectionDetail },
): void {
  if (snapshot.list) {
    client.setQueryData(collectionKeys.list, snapshot.list);
  }
  if (collectionId && snapshot.detail) {
    client.setQueryData(collectionKeys.detail(collectionId), snapshot.detail);
  }
}

export function useCollections() {
  const persistKey = persistKeyFor(collectionKeys.list);
  return useQuery({
    queryKey: collectionKeys.list,
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKey, () =>
        listCollections({ page: 1, pageSize: 100 }, signal),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    staleTime: QUERY_FRESHNESS.collections,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

export function useCollection(id: string | undefined) {
  const persistKey = persistKeyFor(collectionKeys.detail(id ?? ''));
  return useQuery({
    queryKey: collectionKeys.detail(id ?? ''),
    queryFn: async ({ signal }) => {
      if (!id) {
        throw new Error('Collection id is required');
      }
      const result = await networkFirst(persistKey, () =>
        getCollection(id, signal),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    enabled: !!id,
    staleTime: QUERY_FRESHNESS.collections,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

export function useCreateCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; recipeIds?: string[] }) =>
      createCollection(body),
    onSuccess: (collection) => {
      client.setQueryData(collectionKeys.detail(collection.id), collection);
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useRenameCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameCollection(id, { name }),
    onSuccess: (collection) => {
      client.setQueryData(collectionKeys.detail(collection.id), collection);
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useDeleteCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useAddCollectionRecipe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      recipeId,
    }: {
      collectionId: string;
      recipeId: string;
    }) => addCollectionRecipe(collectionId, recipeId),
    onMutate: async ({ collectionId, recipeId }) => {
      const snapshot = await snapshotCollections(client, collectionId);
      client.setQueryData<CollectionsListPage>(collectionKeys.list, (current) =>
        patchListItem(current, collectionId, (item) =>
          withRecipe(item, recipeId),
        ),
      );
      client.setQueryData<CollectionDetail>(
        collectionKeys.detail(collectionId),
        (current) =>
          current
            ? {
                ...withRecipe(current, recipeId),
                recipes: current.recipes,
              }
            : current,
      );
      return snapshot;
    },
    onError: (_error, variables, snapshot) => {
      restoreCollections(client, variables.collectionId, snapshot ?? {});
    },
    onSuccess: (collection) => {
      client.setQueryData(collectionKeys.detail(collection.id), collection);
    },
    onSettled: () => {
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useRemoveCollectionRecipe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      recipeId,
    }: {
      collectionId: string;
      recipeId: string;
    }) => removeCollectionRecipe(collectionId, recipeId),
    onMutate: async ({ collectionId, recipeId }) => {
      const snapshot = await snapshotCollections(client, collectionId);
      client.setQueryData<CollectionsListPage>(collectionKeys.list, (current) =>
        patchListItem(current, collectionId, (item) =>
          withoutRecipe(item, recipeId),
        ),
      );
      client.setQueryData<CollectionDetail>(
        collectionKeys.detail(collectionId),
        (current) =>
          current
            ? {
                ...withoutRecipe(current, recipeId),
                recipes: current.recipes.filter((item) => item.id !== recipeId),
              }
            : current,
      );
      return snapshot;
    },
    onError: (_error, variables, snapshot) => {
      restoreCollections(client, variables.collectionId, snapshot ?? {});
    },
    onSuccess: (collection) => {
      client.setQueryData(collectionKeys.detail(collection.id), collection);
    },
    onSettled: () => {
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}

function applyMembership(
  item: CollectionSummary,
  add: readonly string[],
  remove: readonly string[],
): CollectionSummary {
  const removed = remove.reduce((cur, id) => withoutRecipe(cur, id), item);
  return add.reduce((cur, id) => withRecipe(cur, id), removed);
}

/** Add and remove several recipes on one collection in a single optimistic update. */
export function useSetCollectionMembership() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionId,
      add,
      remove,
    }: {
      collectionId: string;
      add: string[];
      remove: string[];
    }) => {
      for (const recipeId of remove) {
        await removeCollectionRecipe(collectionId, recipeId);
      }
      for (const recipeId of add) {
        await addCollectionRecipe(collectionId, recipeId);
      }
    },
    onMutate: async ({ collectionId, add, remove }) => {
      const snapshot = await snapshotCollections(client, collectionId);
      client.setQueryData<CollectionsListPage>(collectionKeys.list, (current) =>
        patchListItem(current, collectionId, (item) =>
          applyMembership(item, add, remove),
        ),
      );
      client.setQueryData<CollectionDetail>(
        collectionKeys.detail(collectionId),
        (current) => {
          if (!current) return current;
          const next = applyMembership(current, add, remove);
          return {
            ...current,
            recipeIds: next.recipeIds,
            recipeCount: next.recipeCount,
            coverPreviews: next.coverPreviews,
            recipes: current.recipes.filter(
              (item) => !remove.includes(item.id),
            ),
          };
        },
      );
      return snapshot;
    },
    onError: (_error, variables, snapshot) => {
      restoreCollections(client, variables.collectionId, snapshot ?? {});
    },
    onSettled: () => {
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useReorderCollectionRecipes(collectionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (recipeIds: string[]) =>
      reorderCollectionRecipes(collectionId, recipeIds),
    onMutate: async (recipeIds) => {
      const snapshot = await snapshotCollections(client, collectionId);
      client.setQueryData<CollectionDetail>(
        collectionKeys.detail(collectionId),
        (current) => {
          if (!current) {
            return current;
          }
          const byId = new Map(current.recipes.map((item) => [item.id, item]));
          const recipes = recipeIds.flatMap((id, index) => {
            const recipe = byId.get(id);
            return recipe ? [{ ...recipe, sortOrder: index }] : [];
          });
          return {
            ...current,
            recipeIds,
            recipes,
            coverPreviews: current.coverPreviews,
          };
        },
      );
      return snapshot;
    },
    onError: (_error, _recipeIds, snapshot) => {
      restoreCollections(client, collectionId, snapshot ?? {});
    },
    onSuccess: (collection) => {
      client.setQueryData(collectionKeys.detail(collection.id), collection);
    },
    onSettled: () => {
      client
        .invalidateQueries({ queryKey: collectionKeys.all })
        .catch(() => undefined);
    },
  });
}
