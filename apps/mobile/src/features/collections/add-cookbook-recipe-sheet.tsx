import { Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import type { RecipeListItemView } from '@/features/recipes/types';
import {
  duration,
  layoutReorder,
  reanimatedEasing,
  useReducedMotion,
} from '@/lib/motion';
import { colors, fonts } from '@/theme/tokens';

type AddCookbookRecipeSheetProps = {
  visible: boolean;
  recipes: RecipeListItemView[];
  pending?: boolean;
  onClose: () => void;
  onAdd: (recipeId: string, title: string) => Promise<void>;
};

export function AddCookbookRecipeSheet({
  visible,
  recipes,
  pending = false,
  onClose,
  onAdd,
}: AddCookbookRecipeSheetProps) {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');
  const [hidingIds, setHidingIds] = useState<Set<string>>(() => new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setHidingIds(new Set());
      setAddingId(null);
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = recipes.filter((item) => !hidingIds.has(item.id));
    if (!needle) {
      return items;
    }
    return items.filter((item) => item.title.toLowerCase().includes(needle));
  }, [hidingIds, query, recipes]);

  const hideRecipe = (recipeId: string) => {
    setHidingIds((prev) => {
      const next = new Set(prev);
      next.add(recipeId);
      return next;
    });
  };

  const restoreRecipe = (recipeId: string) => {
    setHidingIds((prev) => {
      const next = new Set(prev);
      next.delete(recipeId);
      return next;
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      expandable
      accessibilityLabel="Add a recipe"
    >
      <View style={styles.body}>
        <Text variant="title" className="pb-3">
          Add a recipe
        </Text>

        <View
          className="mb-3 h-12 flex-row items-center rounded-[24px] border border-crust px-4"
          style={{ backgroundColor: colors.searchFill }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes"
            placeholderTextColor={colors.tabInactive}
            accessibilityLabel="Search recipes to add"
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

        <View style={styles.listWrap}>
          {recipes.length === 0 ? (
            <Text variant="caption" className="pb-4">
              Every recipe in your kitchen is already here.
            </Text>
          ) : filtered.length === 0 ? (
            <Text variant="caption" className="pb-4">
              No recipes match that search.
            </Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View className="gap-2.5 pb-1">
                {filtered.map((item) => {
                  const recipe = mapRecipeListItem(item);
                  const busy = pending || addingId === item.id;
                  return (
                    <Animated.View
                      key={item.id}
                      exiting={
                        reduced
                          ? undefined
                          : FadeOut.duration(duration.fast).easing(
                              reanimatedEasing,
                            )
                      }
                      layout={layoutReorder(reduced)}
                    >
                      <View
                        className="min-h-14 w-full flex-row items-center gap-3 rounded-full py-1.5 pl-1.5 pr-2"
                        style={{ backgroundColor: colors.searchFill }}
                      >
                        <PhotoStandIn
                          colors={recipe.placeholder}
                          height={44}
                          radius={22}
                          uri={recipe.thumbnailUrl}
                          label={`photo — ${recipe.title.toLowerCase()}`}
                          className="w-11"
                        />
                        <Text
                          tone="icon"
                          className="flex-1 pr-1"
                          numberOfLines={2}
                        >
                          {recipe.title}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${recipe.title}`}
                          disabled={busy}
                          hitSlop={6}
                          onPress={() => {
                            if (busy) {
                              return;
                            }
                            setAddingId(item.id);
                            hideRecipe(item.id);
                            void onAdd(item.id, item.title)
                              .catch(() => {
                                restoreRecipe(item.id);
                              })
                              .finally(() => {
                                setAddingId((current) =>
                                  current === item.id ? null : current,
                                );
                              });
                          }}
                          className="h-10 w-10 items-center justify-center rounded-full"
                        >
                          <Plus
                            size={22}
                            color={colors.espresso}
                            strokeWidth={2}
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                          />
                        </Pressable>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        <Button
          label="Done"
          variant="inverse"
          className="mt-5"
          onPress={onClose}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 4,
  },
});
