import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, Ellipsis } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { IconButton } from '@/components/ui/icon-button';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { MotionItem } from '@/components/ui/motion-item';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { CollectionFormSheet } from '@/features/collections/collection-form-sheet';
import { CookbookOptionsSheet } from '@/features/collections/cookbook-options-sheet';
import { CookbookRecipeOptionsSheet } from '@/features/collections/cookbook-recipe-options-sheet';
import { collectionDeleteCopy } from '@/features/collections/confirm-delete';
import {
  useAddCollectionRecipe,
  useCollection,
  useDeleteCollection,
  useRemoveCollectionRecipe,
  useRenameCollection,
} from '@/features/collections/hooks';
import type { CollectionRecipe } from '@/features/collections/types';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { announce } from '@/lib/announce';
import { hapticMedium } from '@/lib/haptics';
import { mapUserError } from '@/lib/user-error';
import { colors, fonts } from '@/theme/tokens';

export function CollectionDetail({ collectionId }: { collectionId: string }) {
  const query = useCollection(collectionId);
  const recipesQuery = useRecipes(1, 50);
  const rename = useRenameCollection();
  const removeCollection = useDeleteCollection();
  const addRecipe = useAddCollectionRecipe();
  const removeRecipe = useRemoveCollectionRecipe();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recipeMenuTarget, setRecipeMenuTarget] =
    useState<CollectionRecipe | null>(null);
  const [search, setSearch] = useState('');

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
  const filteredRecipes = useMemo(() => {
    const items = collection?.recipes ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) => item.title.toLowerCase().includes(needle));
  }, [collection?.recipes, search]);

  const busy =
    rename.isPending ||
    removeCollection.isPending ||
    addRecipe.isPending ||
    removeRecipe.isPending;

  const openRecipeOptions = (recipe: CollectionRecipe): void => {
    void hapticMedium();
    setRecipeMenuTarget(recipe);
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
          title: 'Couldn’t load this cookbook.',
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
            {notFound ? mapped.title : 'Couldn’t load this cookbook.'}
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
      <KeyboardAwareScrollView
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-1 flex-row items-center gap-3 px-5 pb-3 pt-1">
          <IconButton
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ backgroundColor: colors.cream }}
          >
            <ChevronLeft size={22} color={colors.cta} strokeWidth={2.2} />
          </IconButton>
          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 text-center text-[16px]"
            style={{ fontFamily: fonts.manrope500 }}
            numberOfLines={1}
          >
            {collection.name}
          </Text>
          <IconButton
            accessibilityLabel="More"
            onPress={() => setMenuOpen(true)}
            style={{ backgroundColor: colors.cream }}
          >
            <Ellipsis size={22} color={colors.espresso} strokeWidth={2} />
          </IconButton>
        </View>

        <View className="px-5 pb-4">
          <View
            className="h-12 flex-row items-center rounded-[24px] border border-crust px-4"
            style={{ backgroundColor: colors.searchFill }}
          >
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search recipes"
              placeholderTextColor={colors.tabInactive}
              accessibilityLabel="Search recipes"
              className="h-full flex-1 text-[15px]"
              style={{
                fontFamily: fonts.manrope500,
                color: colors.espresso,
                paddingVertical: 0,
                textAlignVertical: 'center',
                includeFontPadding: false,
              }}
              returnKeyType="search"
            />
          </View>
        </View>

        {collection.fromCache ? (
          <StaleIndicator
            className="px-5 pb-3"
            message="Showing the last saved cookbook."
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

        {collection.recipes.length === 0 ? (
          <View className="items-center px-5 pt-[30px]">
            <Text
              style={{ fontFamily: fonts.manrope700 }}
              className="text-[19px]"
            >
              Nothing in this cookbook yet.
            </Text>
            <Text variant="caption" className="py-2.5 text-center">
              Add a recipe from here or from a recipe page.
            </Text>
            <Button label="Add a recipe" onPress={() => setAddOpen(true)} />
          </View>
        ) : filteredRecipes.length === 0 ? (
          <View className="items-center px-5 pt-6">
            <Text
              style={{ fontFamily: fonts.manrope700 }}
              className="text-[17px]"
            >
              No recipes match that search.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3.5 px-5">
            {filteredRecipes.map((item, index) => {
              const recipe = mapRecipeListItem(item);
              return (
                <MotionItem
                  key={item.id}
                  preset="card"
                  index={index}
                  className="w-[47%]"
                >
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={recipe.title}
                    accessibilityHint="Long press for options"
                    accessibilityActions={[
                      { name: 'longpress', label: 'Options' },
                    ]}
                    onAccessibilityAction={(event) => {
                      if (event.nativeEvent.actionName === 'longpress') {
                        openRecipeOptions(item);
                      }
                    }}
                    testID={`collection-recipe-${recipe.id}`}
                    onPress={() =>
                      router.push(`/recipe/${recipe.id}` as Href)
                    }
                    onLongPress={() => openRecipeOptions(item)}
                    delayLongPress={350}
                  >
                    <PhotoStandIn
                      colors={recipe.placeholder}
                      height={148}
                      radius={16}
                      uri={recipe.thumbnailUrl}
                      label="photo"
                    />
                    <Text
                      className="pt-[10px] text-[15px] leading-[1.28]"
                      style={{ fontFamily: fonts.manrope700 }}
                      numberOfLines={2}
                    >
                      {recipe.title}
                    </Text>
                  </PressScale>
                </MotionItem>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollView>

      <CookbookOptionsSheet
        visible={menuOpen}
        collectionName={collection.name}
        onClose={() => setMenuOpen(false)}
        onRename={() => {
          setMenuOpen(false);
          setRenameError(null);
          setRenameOpen(true);
        }}
        onAddRecipe={() => {
          setMenuOpen(false);
          setAddOpen(true);
        }}
        onDelete={() => {
          setMenuOpen(false);
          setDeleteOpen(true);
        }}
      />

      <CookbookRecipeOptionsSheet
        visible={!!recipeMenuTarget}
        recipeTitle={recipeMenuTarget?.title ?? ''}
        collectionName={collection.name}
        onClose={() => setRecipeMenuTarget(null)}
        onRemove={() => {
          if (!recipeMenuTarget) {
            return;
          }
          const target = recipeMenuTarget;
          setRecipeMenuTarget(null);
          void removeRecipe
            .mutateAsync({
              collectionId: collection.id,
              recipeId: target.id,
            })
            .then(() => {
              announce(`${target.title} removed from ${collection.name}`);
            })
            .catch((error: unknown) => {
              announce(mapUserError(error, 'collections').message);
            });
        }}
      />

      <CollectionFormSheet
        visible={renameOpen}
        title="Rename cookbook"
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
        confirmLabel="Delete cookbook"
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
