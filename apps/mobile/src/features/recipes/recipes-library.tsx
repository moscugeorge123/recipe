import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { ProfilePersonIcon } from '@/components/icons/recime-tab-icons';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { IconButton } from '@/components/ui/icon-button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { MotionItem } from '@/components/ui/motion-item';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { useCatalog } from '@/features/catalog/use-catalog';
import { AddCookbookRecipeSheet } from '@/features/collections/add-cookbook-recipe-sheet';
import { CollectionFormSheet } from '@/features/collections/collection-form-sheet';
import { CookbookOptionsSheet } from '@/features/collections/cookbook-options-sheet';
import { collectionDeleteCopy } from '@/features/collections/confirm-delete';
import { CoverMosaic } from '@/features/collections/cover-mosaic';
import {
  useAddCollectionRecipe,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useRenameCollection,
} from '@/features/collections/hooks';
import type { CollectionSummary } from '@/features/collections/types';
import { CookingNowCard } from '@/features/home/cooking-now-card';
import { isMigratableRecipeId } from '@/features/kitchen/ids';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { announce } from '@/lib/announce';
import { hapticMedium } from '@/lib/haptics';
import { isOfflineError } from '@/lib/network';
import { mapUserError } from '@/lib/user-error';
import { ApiError } from '@/services/api-client';
import { useKitchenStore } from '@/stores/kitchen-store';
import { colors, fonts } from '@/theme/tokens';

type LibrarySegment = 'cookbooks' | 'recipes';
type TimeFilter = 'any' | 'under30' | 'mid' | 'over60';

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'under30', label: 'Under 30' },
  { id: 'mid', label: '30–60' },
  { id: 'over60', label: 'Over 60' },
];

function matchesTime(
  minutes: number | null | undefined,
  filter: TimeFilter,
): boolean {
  if (filter === 'any') {
    return true;
  }
  if (minutes == null) {
    return false;
  }
  if (filter === 'under30') {
    return minutes < 30;
  }
  if (filter === 'mid') {
    return minutes >= 30 && minutes <= 60;
  }
  return minutes > 60;
}

export function RecipesLibrary() {
  const catalog = useCatalog();
  const list = useCollections();
  const create = useCreateCollection();
  const createCookbook = create.mutateAsync;
  const rename = useRenameCollection();
  const removeCollection = useDeleteCollection();
  const addRecipe = useAddCollectionRecipe();
  const recipesQuery = useRecipes(1, 50, { sort: 'latest' });
  const addCollection = useKitchenStore((state) => state.addCollection);
  const ensuredDefault = useRef(false);

  const [segment, setSegment] = useState<LibrarySegment>('cookbooks');
  const [query, setQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<CollectionSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<CollectionSummary | null>(
    null,
  );
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionSummary | null>(
    null,
  );
  const [addTarget, setAddTarget] = useState<CollectionSummary | null>(null);

  const apiItems = useMemo(() => list.data?.items ?? [], [list.data?.items]);
  const apiIds = useMemo(
    () => new Set(apiItems.map((item) => item.id)),
    [apiItems],
  );
  const pending = catalog.collections.filter(
    (item) => !apiIds.has(item.id) && !isMigratableRecipeId(item.id),
  );

  const search = query.trim().toLowerCase();
  const cookbooks = useMemo(() => {
    if (!search) {
      return apiItems;
    }
    return apiItems.filter((item) => item.name.toLowerCase().includes(search));
  }, [apiItems, search]);

  const recipes = useMemo(() => {
    const items = (recipesQuery.data?.items ?? []).filter((item) => {
      const titleOk = search ? item.title.toLowerCase().includes(search) : true;
      const minutes = item.minutes ?? item.totalTimeMinutes;
      return titleOk && matchesTime(minutes, timeFilter);
    });
    return items.map(mapRecipeListItem);
  }, [recipesQuery.data?.items, search, timeFilter]);

  const addableRecipes = useMemo(() => {
    if (!addTarget) {
      return [];
    }
    const memberIds = new Set(addTarget.recipeIds);
    return (recipesQuery.data?.items ?? []).filter(
      (item) => !memberIds.has(item.id),
    );
  }, [addTarget, recipesQuery.data?.items]);

  const openCookbookOptions = (collection: CollectionSummary): void => {
    void hapticMedium();
    setMenuTarget(collection);
  };
  const ensureUncategorized = useCallback((): void => {
    if (!list.isSuccess || list.isLoading) {
      return;
    }
    if ((list.data?.items.length ?? 0) > 0) {
      return;
    }
    if (ensuredDefault.current || create.isPending) {
      return;
    }
    ensuredDefault.current = true;
    void createCookbook({ name: 'Uncategorized' }).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        return;
      }
    });
  }, [
    create.isPending,
    createCookbook,
    list.data?.items.length,
    list.isLoading,
    list.isSuccess,
  ]);

  useEffect(() => {
    ensureUncategorized();
  }, [ensureUncategorized]);

  const closeForm = (): void => {
    if (create.isPending) {
      return;
    }
    setFormOpen(false);
    setFormError(null);
  };

  const submitCookbook = async (name: string): Promise<void> => {
    setFormError(null);
    try {
      try {
        const created = await createCookbook({ name });
        announce(`${created.name} created`);
      } catch (error) {
        if (
          isOfflineError(error) &&
          !(error instanceof ApiError && error.status === 409)
        ) {
          addCollection(name);
          announce(`${name} saved on this device until you’re back online`);
        } else {
          throw error;
        }
      }
      setFormOpen(false);
    } catch (error) {
      setFormError(mapUserError(error, 'collections').message);
    }
  };

  const refreshing =
    segment === 'cookbooks'
      ? !!list.isFetching && !list.isLoading
      : !!recipesQuery.isFetching && !recipesQuery.isLoading;

  return (
    <Screen>
      <KeyboardAwareScrollView
        testID="recipes-library-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (segment === 'cookbooks') {
                void list.refetch();
                return;
              }
              void recipesQuery.refetch();
            }}
            tintColor={colors.paprika}
            accessibilityLabel={
              segment === 'cookbooks'
                ? 'Refresh cookbooks'
                : 'Refresh recipes'
            }
          />
        }
      >
        <View className="flex-row items-center justify-between px-5 pb-4 pt-1">
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 32,
              lineHeight: 36,
              letterSpacing: -0.8,
              color: colors.paprika,
            }}
          >
            Recipe
          </Text>
          <IconButton
            accessibilityLabel="Profile"
            onPress={() => router.push('/profile' as Href)}
          >
            <ProfilePersonIcon size={22} color={colors.espresso} />
          </IconButton>
        </View>
        <CookingNowCard />

        <View
          accessibilityRole="tablist"
          className="flex-row items-end px-5 pb-4"
        >
          {(
            [
              { id: 'cookbooks', label: 'Cookbooks' },
              { id: 'recipes', label: 'All Recipes' },
            ] as const
          ).map((item) => {
            const selected = segment === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  setSegment(item.id);
                  if (item.id === 'cookbooks') {
                    setFilterOpen(false);
                  }
                }}
                className="mr-6 min-h-11 justify-end"
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 16,
                    color: selected ? colors.espresso : colors.tabInactive,
                  }}
                >
                  {item.label}
                </Text>
                <View
                  className="mt-1.5 h-[2px] rounded-full"
                  style={{
                    backgroundColor: selected ? colors.espresso : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center gap-2 px-5 pb-4">
          <View
            className="h-12 flex-1 flex-row items-center rounded-[24px] border border-crust px-4"
            style={{ backgroundColor: colors.searchFill }}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                segment === 'cookbooks' ? 'Search cookbooks' : 'Search recipes'
              }
              placeholderTextColor={colors.tabInactive}
              accessibilityLabel="Search titles"
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
          {segment === 'recipes' ? (
            <IconButton
              accessibilityLabel="Sort and filter"
              onPress={() => setFilterOpen(true)}
              style={{ backgroundColor: colors.searchFill }}
            >
              <SlidersHorizontal
                size={20}
                color={colors.espresso}
                strokeWidth={1.75}
              />
            </IconButton>
          ) : null}
        </View>

        {segment === 'cookbooks' ? (
          <View className="px-5">
            {list.data?.fromCache ? (
              <StaleIndicator
                className="pb-3"
                message="Showing last loaded cookbooks. Retry if this looks old."
              />
            ) : null}
            {list.isError ? (
              <View className="pb-3">
                <InlineErrorPanel
                  message={
                    mapUserError(
                      list.error ?? new Error('offline'),
                      'collections',
                      {
                        log: !!list.error,
                      },
                    ).message
                  }
                  retrying={list.isFetching}
                  onRetry={() => {
                    void list.refetch();
                  }}
                />
              </View>
            ) : null}
            {list.isLoading && apiItems.length === 0 ? (
              <ContentSkeleton shape="list" />
            ) : null}
            <View className="flex-row flex-wrap gap-3.5">
              {cookbooks.map((collection, index) => (
                <MotionItem
                  key={collection.id}
                  preset="card"
                  index={index}
                  className="w-[47%]"
                >
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${collection.name}`}
                    accessibilityHint="Long press for options"
                    accessibilityActions={[
                      { name: 'longpress', label: 'Options' },
                    ]}
                    onAccessibilityAction={(event) => {
                      if (event.nativeEvent.actionName === 'longpress') {
                        openCookbookOptions(collection);
                      }
                    }}
                    onPress={() =>
                      router.push(`/collection/${collection.id}` as Href)
                    }
                    onLongPress={() => openCookbookOptions(collection)}
                    delayLongPress={350}
                    className="rounded-[18px] border border-crust bg-bg-elevated p-[15px]"
                  >
                    <CoverMosaic
                      covers={collection.coverPreviews.map((cover) => ({
                        recipeId: cover.recipeId,
                        thumbnailUrl: cover.thumbnailUrl,
                        placeholder: catalog.get(cover.recipeId)?.placeholder,
                      }))}
                    />
                    <Text
                      style={{ fontFamily: fonts.manrope700 }}
                      className="text-[15px]"
                    >
                      {collection.name}
                    </Text>
                    <Text variant="caption" className="pt-1.5 text-[12px]">
                      {collection.recipeCount}{' '}
                      {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
                    </Text>
                  </PressScale>
                </MotionItem>
              ))}
              {pending.map((collection) => (
                <View
                  key={collection.id}
                  className="w-[47%] rounded-[18px] border border-dashed border-crust bg-bg-elevated p-[15px]"
                >
                  <CoverMosaic
                    covers={collection.recipeIds.slice(0, 4).map((id) => ({
                      recipeId: id,
                      thumbnailUrl: catalog.get(id)?.thumbnailUrl ?? null,
                      placeholder: catalog.get(id)?.placeholder,
                    }))}
                  />
                  <Text
                    style={{ fontFamily: fonts.manrope700 }}
                    className="text-[15px]"
                  >
                    {collection.name}
                  </Text>
                  <Text variant="caption" className="pt-1.5 text-[12px]">
                    Waiting to sync
                  </Text>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New cookbook"
                onPress={() => {
                  setFormError(null);
                  setFormOpen(true);
                }}
                className="min-h-[120px] w-[47%] items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-crust"
              >
                <Text className="text-center text-[14px]" tone="muted">
                  + New{'\n'}cookbook
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="px-5">
            {recipesQuery.data?.fromCache ? (
              <StaleIndicator
                className="pb-3"
                message="Showing last loaded recipes. Retry if this looks old."
              />
            ) : null}
            {recipesQuery.isError ? (
              <View className="pb-3">
                <InlineErrorPanel
                  message={
                    mapUserError(
                      recipesQuery.error ?? new Error('offline'),
                      'home',
                      { log: !!recipesQuery.error },
                    ).message
                  }
                  retrying={recipesQuery.isFetching}
                  onRetry={() => {
                    void recipesQuery.refetch();
                  }}
                />
              </View>
            ) : null}
            {recipesQuery.isLoading && recipes.length === 0 ? (
              <ContentSkeleton shape="grid" />
            ) : null}
            <View className="flex-row flex-wrap gap-3.5">
              {recipes.map((recipe, index) => (
                <MotionItem
                  key={recipe.id}
                  preset="card"
                  index={index}
                  className="w-[47%]"
                >
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={recipe.title}
                    testID={`library-recipe-${recipe.id}`}
                    onPress={() => router.push(`/recipe/${recipe.id}` as Href)}
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
              ))}
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>

      <CollectionFormSheet
        visible={formOpen}
        title="New cookbook"
        submitLabel="Create"
        pending={create.isPending}
        error={formError}
        onClose={closeForm}
        onSubmit={(name) => {
          void submitCookbook(name);
        }}
      />
      <CookbookOptionsSheet
        visible={!!menuTarget}
        collectionName={menuTarget?.name ?? ''}
        onClose={() => setMenuTarget(null)}
        onRename={() => {
          if (!menuTarget) {
            return;
          }
          setRenameError(null);
          setRenameTarget(menuTarget);
          setMenuTarget(null);
        }}
        onAddRecipe={() => {
          if (!menuTarget) {
            return;
          }
          setAddTarget(menuTarget);
          setMenuTarget(null);
        }}
        onDelete={() => {
          if (!menuTarget) {
            return;
          }
          setDeleteTarget(menuTarget);
          setMenuTarget(null);
        }}
      />
      <CollectionFormSheet
        visible={!!renameTarget}
        title="Rename cookbook"
        submitLabel="Save name"
        initialName={renameTarget?.name ?? ''}
        pending={rename.isPending}
        error={renameError}
        onClose={() => {
          if (!rename.isPending) {
            setRenameTarget(null);
            setRenameError(null);
          }
        }}
        onSubmit={(name) => {
          if (!renameTarget) {
            return;
          }
          void rename
            .mutateAsync({ id: renameTarget.id, name })
            .then((updated) => {
              announce(`${updated.name} renamed`);
              setRenameTarget(null);
            })
            .catch((error: unknown) => {
              setRenameError(mapUserError(error, 'collections').message);
            });
        }}
      />
      <AddCookbookRecipeSheet
        visible={!!addTarget}
        recipes={addableRecipes}
        pending={addRecipe.isPending}
        onClose={() => setAddTarget(null)}
        onAdd={async (recipeId, title) => {
          if (!addTarget) {
            return;
          }
          await addRecipe.mutateAsync({
            collectionId: addTarget.id,
            recipeId,
          });
          announce(`${title} added to ${addTarget.name}`);
        }}
      />
      <ConfirmSheet
        visible={!!deleteTarget}
        title={
          deleteTarget
            ? collectionDeleteCopy(deleteTarget.name).title
            : 'Delete cookbook?'
        }
        message={
          deleteTarget
            ? collectionDeleteCopy(deleteTarget.name).message
            : ''
        }
        confirmLabel="Delete cookbook"
        cancelLabel="Keep"
        destructive
        pending={removeCollection.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          void removeCollection.mutateAsync(deleteTarget.id).then(() => {
            announce(
              `${deleteTarget.name} deleted. Recipes are still in your kitchen.`,
            );
            setDeleteTarget(null);
          });
        }}
      />
      <Sheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        accessibilityLabel="Sort and filter"
      >
        <Text variant="title" className="pb-3">
          Time
        </Text>
        <View className="flex-row flex-wrap gap-2 pb-4">
          {TIME_FILTERS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={timeFilter === item.id}
              onPress={() => setTimeFilter(item.id)}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
