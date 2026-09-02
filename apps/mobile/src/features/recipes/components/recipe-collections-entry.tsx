import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
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

export function RecipeCollectionsEntry({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const leftover = useKitchenStore((state) => state.collections);
  const list = useCollections();
  const add = useAddCollectionRecipe();
  const remove = useRemoveCollectionRecipe();
  const create = useCreateCollection();
  const apiRecipe = isMigratableRecipeId(recipeId);
  const collections = list.data?.items ?? [];
  const filed = collections.filter((collection) =>
    collection.recipeIds.includes(recipeId),
  );
  const leftoverFiled = leftover.filter((collection) =>
    collection.recipeIds.includes(recipeId),
  );
  const names = apiRecipe
    ? filed.map((collection) => collection.name)
    : leftoverFiled.map((collection) => collection.name);
  const mutating = add.isPending || remove.isPending || create.isPending;

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
      announce('Could not update collections. Try again.');
    }
  };

  const createAndAdd = async (): Promise<void> => {
    const name = newName.trim();
    if (!name || !apiRecipe) {
      return;
    }
    setCreateError(null);
    try {
      await create.mutateAsync({ name, recipeIds: [recipeId] });
      announce(`Created ${name} and added this recipe`);
      setNewName('');
    } catch (error) {
      setCreateError(mapUserError(error, 'collections').message);
    }
  };

  return (
    <View className="mt-6">
      <Text variant="section">COLLECTIONS</Text>
      {names.length ? (
        <Text variant="caption" className="pt-2">
          {names.join(' · ')}
        </Text>
      ) : (
        <Text variant="caption" className="pt-2">
          Not in a collection yet.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to a collection"
        onPress={() => setOpen(true)}
        className="min-h-11 flex-row items-center justify-between border-b border-crust py-3"
      >
        <Text tone="icon">Add to a collection</Text>
        <Text variant="caption">
          {apiRecipe ? 'File it' : 'On this device'}
        </Text>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        accessibilityLabel="Collections"
      >
        <Text variant="title" className="pb-2">
          File this recipe
        </Text>
        <Text variant="caption" className="pb-4">
          {apiRecipe
            ? 'Choose a collection or make a new one. You can keep this sheet open.'
            : 'Demo recipes stay on this device until they’re imported.'}
        </Text>
        <ScrollView style={{ maxHeight: 280 }}>
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
                    className="min-h-11 flex-row items-center justify-between border-b border-crust py-[13px]"
                  >
                    <View className="flex-1 flex-row items-center gap-[11px] pr-3">
                      <View
                        className="h-4 w-4 rounded-full border-2"
                        style={{
                          borderColor: selected ? colors.paprika : colors.crust,
                          backgroundColor: selected
                            ? colors.paprika
                            : 'transparent',
                        }}
                      />
                      <Text className="flex-1 text-[14.5px]" tone="icon">
                        {collection.name}
                      </Text>
                    </View>
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
                  className="min-h-11 flex-row items-center justify-between border-b border-crust py-[13px]"
                >
                  <Text tone="icon">{collection.name}</Text>
                  <Text variant="caption">On device</Text>
                </View>
              ))}
        </ScrollView>
        {apiRecipe ? (
          <View className="pt-4">
            <Input
              label="New collection"
              value={newName}
              onChangeText={(value) => {
                setNewName(value);
                if (createError) {
                  setCreateError(null);
                }
              }}
              placeholder="Friends Dinners"
              editable={!create.isPending}
              error={createError ?? undefined}
            />
            <Button
              label="Create and add"
              variant="inverse"
              className="mt-3"
              disabled={create.isPending || !newName.trim()}
              onPress={() => {
                void createAndAdd();
              }}
            />
          </View>
        ) : null}
        <Button
          label="Done"
          variant="ghost"
          className="mt-3 bg-peach"
          disabled={false}
          onPress={() => setOpen(false)}
        />
      </Sheet>
    </View>
  );
}
