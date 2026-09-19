import { Check, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { CollectionFormSheet } from '@/features/collections/collection-form-sheet';
import {
  useAddCollectionRecipe,
  useCollections,
  useCreateCollection,
  useRemoveCollectionRecipe,
} from '@/features/collections/hooks';
import { isMigratableRecipeId } from '@/features/kitchen/ids';
import { announce } from '@/lib/announce';
import { mapUserError } from '@/lib/user-error';
import { useKitchenStore } from '@/stores/kitchen-store';
import { colors } from '@/theme/tokens';

type RecipeCollectionsEntryProps = {
  recipeId: string;
  visible: boolean;
  onClose: () => void;
};

export function RecipeCollectionsEntry({
  recipeId,
  visible,
  onClose,
}: RecipeCollectionsEntryProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const leftover = useKitchenStore((state) => state.collections);
  const list = useCollections();
  const add = useAddCollectionRecipe();
  const remove = useRemoveCollectionRecipe();
  const create = useCreateCollection();
  const apiRecipe = isMigratableRecipeId(recipeId);
  const collections = list.data?.items ?? [];
  const mutating = add.isPending || remove.isPending || create.isPending;

  const closeCreate = () => {
    if (create.isPending) {
      return;
    }
    setCreateOpen(false);
    setCreateError(null);
  };

  const dismiss = () => {
    setCreateOpen(false);
    setCreateError(null);
    onClose();
  };

  const toggle = async (
    collectionId: string,
    selected: boolean,
    name: string,
  ) => {
    if (!apiRecipe) {
      return;
    }
    try {
      if (selected) {
        await remove.mutateAsync({ collectionId, recipeId });
        announce(`Removed from ${name}`);
      } else {
        await add.mutateAsync({ collectionId, recipeId });
        announce(`Added to ${name}`);
      }
    } catch {
      announce('Could not update cookbooks. Try again.');
    }
  };

  const createAndAdd = async (name: string): Promise<void> => {
    if (!apiRecipe) {
      return;
    }
    setCreateError(null);
    try {
      await create.mutateAsync({ name, recipeIds: [recipeId] });
      announce(`Created ${name} and added this recipe`);
      setCreateOpen(false);
    } catch (error) {
      setCreateError(mapUserError(error, 'collections').message);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={dismiss}
        accessibilityLabel="Cookbooks"
      >
        <Text variant="title" className="pb-2">
          File this recipe
        </Text>
        <Text variant="caption" className="pb-4">
          {apiRecipe
            ? 'Choose a cookbook, or tap + to make a new one. You can keep this sheet open.'
            : 'Demo recipes stay on this device until they’re imported.'}
        </Text>
        <ScrollView style={{ maxHeight: 280 }}>
          <View className="gap-2.5 pb-1">
            {apiRecipe
              ? collections.map((collection) => {
                  const selected = collection.recipeIds.includes(recipeId);
                  return (
                    <Pressable
                      key={collection.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, busy: mutating }}
                      accessibilityLabel={collection.name}
                      onPress={() => {
                        void toggle(collection.id, selected, collection.name);
                      }}
                      className="min-h-14 w-full flex-row items-center gap-3 rounded-full py-2.5 pl-4 pr-3"
                      style={{ backgroundColor: colors.searchFill }}
                    >
                      <View
                        className="h-5 w-5 items-center justify-center rounded-[6px]"
                        style={{
                          borderWidth: 1.5,
                          borderColor: selected ? colors.cta : colors.crust,
                          backgroundColor: selected
                            ? colors.cta
                            : 'transparent',
                        }}
                      >
                        {selected ? (
                          <Check
                            size={13}
                            color={colors.onPrimary}
                            strokeWidth={3}
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                          />
                        ) : null}
                      </View>
                      <Text className="flex-1 text-[14.5px]" tone="icon">
                        {collection.name}
                      </Text>
                      <Text variant="caption">
                        {collection.recipeCount}{' '}
                        {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
                      </Text>
                    </Pressable>
                  );
                })
              : leftover.map((collection) => (
                  <View
                    key={collection.id}
                    className="min-h-14 w-full flex-row items-center justify-between rounded-full px-4 py-2.5"
                    style={{ backgroundColor: colors.searchFill }}
                  >
                    <Text tone="icon">{collection.name}</Text>
                    <Text variant="caption">On device</Text>
                  </View>
                ))}
          </View>
        </ScrollView>
        <View className="mt-4 flex-row items-center gap-2.5">
          {apiRecipe ? (
            <Button
              label="New cookbook"
              size="icon"
              variant="primary"
              style={{ backgroundColor: colors.paprika }}
              disabled={create.isPending}
              icon={
                <Plus
                  size={22}
                  color={colors.onPrimary}
                  strokeWidth={2.4}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              }
              onPress={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            />
          ) : null}
          <Button
            label="Done"
            variant="primary"
            className="flex-1"
            disabled={false}
            onPress={dismiss}
          />
        </View>
      </Sheet>
      <CollectionFormSheet
        visible={createOpen}
        title="New cookbook"
        submitLabel="Create and add recipe"
        pending={create.isPending}
        error={createError}
        onClose={closeCreate}
        onSubmit={(name) => {
          void createAndAdd(name);
        }}
      />
    </>
  );
}
