import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { MotionItem } from '@/components/ui/motion-item';
import { Screen } from '@/components/ui/screen';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { CollectionFormSheet } from '@/features/collections/collection-form-sheet';
import { collectionDeleteCopy } from '@/features/collections/confirm-delete';
import { CoverMosaic } from '@/features/collections/cover-mosaic';
import {
  useAddCollectionRecipe,
  useCollection,
  useDeleteCollection,
  useRemoveCollectionRecipe,
  useRenameCollection,
  useReorderCollectionRecipes,
} from '@/features/collections/hooks';
import { RecipeCard } from '@/features/home/recipe-card';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { announce } from '@/lib/announce';
import { showUndoToast } from '@/lib/undo-toast';
import { mapUserError } from '@/lib/user-error';
import { colors, fonts } from '@/theme/tokens';

export function CollectionDetail({ collectionId }: { collectionId: string }) {
  const query = useCollection(collectionId);
  const recipesQuery = useRecipes(1, 50);
  const rename = useRenameCollection();
  const removeCollection = useDeleteCollection();
  const addRecipe = useAddCollectionRecipe();
  const removeRecipe = useRemoveCollectionRecipe();
  const reorder = useReorderCollectionRecipes(collectionId);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const collection = query.data;
  const memberIds = useMemo(
    () => new Set(collection?.recipeIds ?? []),
    [collection?.recipeIds],
  );
  const addable = useMemo(
    () =>
      (recipesQuery.data?.items ?? []).filter(
        (item) => !memberIds.has(item.id),
      ),
    [memberIds, recipesQuery.data?.items],
  );

  const busy =
    rename.isPending ||
    removeCollection.isPending ||
    addRecipe.isPending ||
    removeRecipe.isPending ||
    reorder.isPending;

  const move = (recipeId: string, direction: -1 | 1): void => {
    if (!collection) {
      return;
    }
    const ids = [...collection.recipeIds];
    const index = ids.indexOf(recipeId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) {
      return;
    }
    const swap = ids[index]!;
    ids[index] = ids[next]!;
    ids[next] = swap;
    void reorder.mutateAsync(ids).then(() => {
      announce('Recipe order updated');
    });
  };

  if (query.isLoading && !collection) {
    return (
      <Screen>
        <View className="px-5 pt-1">
          <ContentSkeleton shape="detail" />
        </View>
      </Screen>
    );
  }

  if (query.isError && !collection) {
    const mapped = query.error
      ? mapUserError(query.error, 'collections')
      : {
          code: undefined,
          title: 'Couldn’t load this collection.',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          retryable: true,
        };
    const notFound = mapped.code === 'COLLECTION_NOT_FOUND';
    return (
      <Screen>
        <View className="px-5 pt-10">
          <Text
            style={{ fontFamily: fonts.manrope700 }}
            className="pb-4 text-[19px]"
          >
            {notFound ? mapped.title : 'Couldn’t load this collection.'}
          </Text>
          <InlineErrorPanel
            message={
              notFound ? mapped.message : 'Check your connection and try again.'
            }
            retryLabel="Retry"
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
          <Button
            label="Back to kitchen"
            variant="ghost"
            className="mt-2"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  if (!collection) {
    return null;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-5 pb-4 pt-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center"
          >
            <Text className="text-[22px]">‹</Text>
          </Pressable>
          <Text variant="display" accessibilityRole="header" className="flex-1">
            {collection.name}
          </Text>
        </View>
        {collection.fromCache ? (
          <StaleIndicator
            className="px-5 pb-3"
            message="Showing the last saved collection."
          />
        ) : null}
        {query.isError ? (
          <View className="px-5 pb-3">
            <InlineErrorPanel
              message={
                mapUserError(
                  query.error ?? new Error('offline'),
                  'collections',
                  {
                    log: !!query.error,
                  },
                ).message
              }
              retryLabel="Retry"
              retrying={query.isFetching}
              onRetry={() => {
                void query.refetch();
              }}
            />
          </View>
        ) : null}
        <View className="px-5">
          <CoverMosaic covers={collection.coverPreviews} height={72} />
          <Text variant="caption">
            {collection.recipeCount}{' '}
            {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
          </Text>
          <View className="flex-row gap-2 pt-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rename ${collection.name}`}
              onPress={() => {
                setRenameError(null);
                setRenameOpen(true);
              }}
              className="min-h-11 flex-1 justify-center rounded-[14px] bg-peach px-3"
            >
              <Text className="text-center text-[13px]" tone="icon">
                Rename
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add recipe"
              onPress={() => setAddOpen(true)}
              className="min-h-11 flex-1 justify-center rounded-[14px] px-3"
              style={{ backgroundColor: colors.basilSoft }}
            >
              <Text className="text-center text-[13px]" tone="icon">
                Add recipe
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${collection.name}`}
              onPress={() => setDeleteOpen(true)}
              className="min-h-11 flex-1 justify-center rounded-[14px] px-3"
              style={{ backgroundColor: colors.chili50 }}
            >
              <Text
                className="text-center text-[13px]"
                style={{ color: colors.chili }}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        </View>

        {collection.recipes.length === 0 ? (
          <View className="items-center px-5 pt-[30px]">
            <Text
              style={{ fontFamily: fonts.manrope700 }}
              className="text-[19px]"
            >
              Nothing in this collection yet.
            </Text>
            <Text variant="caption" className="py-2.5 text-center">
              Add a recipe from here or from a recipe page.
            </Text>
            <Button label="Add a recipe" onPress={() => setAddOpen(true)} />
          </View>
        ) : (
          <View className="px-5 pt-5">
            {collection.recipes.map((item, index) => {
              const recipe = mapRecipeListItem(item);
              return (
                <MotionItem
                  key={item.id}
                  preset="card"
                  index={index}
                  layout
                  className="mb-5"
                >
                  <RecipeCard recipe={recipe} photoHeight={132} />
                  <View className="flex-row gap-2 pt-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${item.title} up`}
                      disabled={busy || index === 0}
                      onPress={() => move(item.id, -1)}
                      className="min-h-11 flex-1 items-center justify-center rounded-[14px] bg-linen"
                    >
                      <Text tone="icon">Up</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${item.title} down`}
                      disabled={busy || index === collection.recipes.length - 1}
                      onPress={() => move(item.id, 1)}
                      className="min-h-11 flex-1 items-center justify-center rounded-[14px] bg-linen"
                    >
                      <Text tone="icon">Down</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.title} from ${collection.name}`}
                      disabled={busy}
                      onPress={() => {
                        void removeRecipe
                          .mutateAsync({
                            collectionId: collection.id,
                            recipeId: item.id,
                          })
                          .then(() => {
                            announce(
                              `${item.title} removed from ${collection.name}`,
                            );
                            showUndoToast(`${item.title} removed`, () => {
                              void addRecipe.mutateAsync({
                                collectionId: collection.id,
                                recipeId: item.id,
                              });
                            });
                          });
                      }}
                      className="min-h-11 flex-1 items-center justify-center rounded-[14px]"
                      style={{ backgroundColor: colors.chili50 }}
                    >
                      <Text style={{ color: colors.chili }}>Remove</Text>
                    </Pressable>
                  </View>
                </MotionItem>
              );
            })}
          </View>
        )}
      </ScrollView>

      <CollectionFormSheet
        visible={renameOpen}
        title="Rename collection"
        submitLabel="Save name"
        initialName={collection.name}
        pending={rename.isPending}
        error={renameError}
        onClose={() => {
          if (!rename.isPending) {
            setRenameOpen(false);
            setRenameError(null);
          }
        }}
        onSubmit={(name) => {
          void rename
            .mutateAsync({ id: collection.id, name })
            .then((updated) => {
              announce(`${updated.name} renamed`);
              setRenameOpen(false);
            })
            .catch((error: unknown) => {
              setRenameError(mapUserError(error, 'collections').message);
            });
        }}
      />

      <Sheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        accessibilityLabel="Add a recipe"
      >
        <Text variant="title" className="pb-3">
          Add a recipe
        </Text>
        {addable.length === 0 ? (
          <Text variant="caption" className="pb-4">
            Every recipe in your kitchen is already here.
          </Text>
        ) : (
          addable.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.title}`}
              disabled={busy}
              onPress={() => {
                void addRecipe
                  .mutateAsync({
                    collectionId: collection.id,
                    recipeId: item.id,
                  })
                  .then(() => {
                    announce(`${item.title} added to ${collection.name}`);
                  });
              }}
              className="min-h-11 flex-row items-center justify-between border-b border-crust py-3"
            >
              <Text tone="icon" className="flex-1 pr-3">
                {item.title}
              </Text>
              <Text variant="caption">Add</Text>
            </Pressable>
          ))
        )}
        <Button
          label="Done"
          variant="inverse"
          className="mt-5"
          onPress={() => setAddOpen(false)}
        />
      </Sheet>
      <ConfirmSheet
        visible={deleteOpen}
        title={collectionDeleteCopy(collection.name).title}
        message={collectionDeleteCopy(collection.name).message}
        confirmLabel="Delete collection"
        cancelLabel="Keep"
        destructive
        pending={removeCollection.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          void removeCollection.mutateAsync(collection.id).then(() => {
            announce(
              `${collection.name} deleted. Recipes are still in your kitchen.`,
            );
            setDeleteOpen(false);
            router.back();
          });
        }}
      />
    </Screen>
  );
}
