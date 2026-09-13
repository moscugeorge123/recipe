import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { MotionItem } from '@/components/ui/motion-item';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import {
  DeleteCookbookIcon,
  RenameCookbookIcon,
} from '@/components/icons/cookbook-action-icons';
import { useCatalog } from '@/features/catalog/use-catalog';
import { CollectionFormSheet } from '@/features/collections/collection-form-sheet';
import { collectionDeleteCopy } from '@/features/collections/confirm-delete';
import { CoverMosaic } from '@/features/collections/cover-mosaic';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useRenameCollection,
} from '@/features/collections/hooks';
import { isMigratableRecipeId } from '@/features/kitchen/ids';
import { announce } from '@/lib/announce';
import { isOfflineError } from '@/lib/network';
import { mapUserError } from '@/lib/user-error';
import { ApiError } from '@/services/api-client';
import { useKitchenStore } from '@/stores/kitchen-store';
import { colors, fonts } from '@/theme/tokens';

type FormState =
  { mode: 'create' } | { mode: 'rename'; id: string; name: string };

export function KitchenCollections() {
  const catalog = useCatalog();
  const list = useCollections();
  const create = useCreateCollection();
  const rename = useRenameCollection();
  const remove = useDeleteCollection();
  const addCollection = useKitchenStore((state) => state.addCollection);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const apiItems = useMemo(() => list.data?.items ?? [], [list.data?.items]);
  const apiIds = useMemo(
    () => new Set(apiItems.map((item) => item.id)),
    [apiItems],
  );
  const pending = catalog.collections.filter(
    (item) => !apiIds.has(item.id) && !isMigratableRecipeId(item.id),
  );

  const closeForm = (): void => {
    if (create.isPending || rename.isPending) {
      return;
    }
    setForm(null);
    setFormError(null);
  };

  const submitForm = async (name: string): Promise<void> => {
    if (!form) {
      return;
    }
    setFormError(null);
    try {
      if (form.mode === 'create') {
        try {
          const created = await create.mutateAsync({ name });
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
      } else {
        await rename.mutateAsync({ id: form.id, name });
        announce(`${name} renamed`);
      }
      setForm(null);
    } catch (error) {
      setFormError(mapUserError(error, 'collections').message);
    }
  };

  return (
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
              mapUserError(list.error ?? new Error('offline'), 'collections', {
                log: !!list.error,
              }).message
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
        {apiItems.map((collection, index) => (
          <MotionItem
            key={collection.id}
            preset="card"
            index={index}
            className="w-[47%] rounded-[18px] border border-crust bg-bg-elevated p-[15px]"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${collection.name}`}
              onPress={() =>
                router.push(`/collection/${collection.id}` as Href)
              }
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
            </Pressable>
            <View className="flex-row gap-2 pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rename ${collection.name}`}
                onPress={() => {
                  setFormError(null);
                  setForm({
                    mode: 'rename',
                    id: collection.id,
                    name: collection.name,
                  });
                }}
                className="min-h-11 flex-1 flex-row items-center gap-2"
              >
                <RenameCookbookIcon size={16} color={colors.paprika} />
                <Text tone="primary" className="text-[13px]">
                  Rename
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${collection.name}`}
                onPress={() =>
                  setPendingDelete({
                    id: collection.id,
                    name: collection.name,
                  })
                }
                className="min-h-11 flex-1 flex-row items-center gap-2"
              >
                <DeleteCookbookIcon size={16} color={colors.chili} />
                <Text className="text-[13px]" style={{ color: colors.chili }}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </MotionItem>
        ))}
        {pending.map((collection) => (
          <View
            key={collection.id}
            className="w-[47%] rounded-[18px] border border-dashed border-crust bg-bg-elevated p-[15px]"
          >
            <CoverMosaic
              covers={collection.recipeIds.slice(0, 3).map((id) => ({
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
            setForm({ mode: 'create' });
          }}
          className="min-h-[120px] w-[47%] items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-crust"
        >
          <Text className="text-center text-[14px]" tone="muted">
            + New{'\n'}cookbook
          </Text>
        </Pressable>
      </View>
      <CollectionFormSheet
        visible={!!form}
        title={form?.mode === 'rename' ? 'Rename cookbook' : 'New cookbook'}
        submitLabel={form?.mode === 'rename' ? 'Save name' : 'Create'}
        initialName={form && form.mode === 'rename' ? form.name : ''}
        pending={create.isPending || rename.isPending}
        error={formError}
        onClose={closeForm}
        onSubmit={(name) => {
          void submitForm(name);
        }}
      />
      <ConfirmSheet
        visible={!!pendingDelete}
        title={
          pendingDelete
            ? collectionDeleteCopy(pendingDelete.name).title
            : 'Delete cookbook?'
        }
        message={
          pendingDelete ? collectionDeleteCopy(pendingDelete.name).message : ''
        }
        confirmLabel="Delete cookbook"
        cancelLabel="Keep"
        destructive
        pending={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) {
            return;
          }
          const { id, name } = pendingDelete;
          void remove.mutateAsync(id).then(() => {
            announce(`${name} deleted. Recipes are still in your kitchen.`);
            setPendingDelete(null);
          });
        }}
      />
    </View>
  );
}
