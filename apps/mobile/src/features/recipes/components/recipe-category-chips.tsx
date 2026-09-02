import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { MotionItem } from '@/components/ui/motion-item';
import { Text } from '@/components/ui/text';
import {
  useAssignRecipeCategories,
  useCategories,
} from '@/features/recipes/hooks/use-recipe-editor';
import type { RecipeView } from '@/features/recipes/types';
import { colors } from '@/theme/tokens';

type RecipeCategoryChipsProps = {
  recipe: RecipeView;
  editable?: boolean;
};

export function RecipeCategoryChips({
  recipe,
  editable = false,
}: RecipeCategoryChipsProps) {
  const assigned = recipe.categories ?? [];
  const [editing, setEditing] = useState(false);
  const catalog = useCategories({
    enabled: editable && editing && recipe.origin === 'api',
  });
  const assign = useAssignRecipeCategories(recipe);
  const selectedIds = assigned.map((category) => category.id);

  const toggle = (categoryId: string) => {
    const next = selectedIds.includes(categoryId)
      ? selectedIds.filter((id) => id !== categoryId)
      : [...selectedIds, categoryId];
    if (next.length === 0) {
      return;
    }
    assign.mutate(next);
  };

  if (!assigned.length && !editing) {
    return editable && recipe.origin === 'api' ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add categories"
        onPress={() => setEditing(true)}
        className="mt-3 min-h-11 justify-center"
      >
        <Text tone="muted">Add categories</Text>
      </Pressable>
    ) : null;
  }

  if (editing) {
    return (
      <View className="mt-3">
        <View className="flex-row flex-wrap gap-2">
          {(catalog.data ?? assigned).map((category) => (
            <MotionItem key={category.id} preset="chip">
              <Chip
                label={category.name}
                selected={selectedIds.includes(category.id)}
                disabled={assign.isPending}
                onPress={() => toggle(category.id)}
              />
            </MotionItem>
          ))}
        </View>
        {selectedIds.length === 0 ? (
          <Text className="pt-2" style={{ color: colors.chili }}>
            Keep at least one category.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done editing categories"
          onPress={() => setEditing(false)}
          className="mt-1 min-h-11 justify-center"
        >
          <Text tone="muted">Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-2">
      {assigned.map((category) =>
        editable ? (
          <MotionItem key={category.id} preset="chip">
            <Chip label={category.name} onPress={() => setEditing(true)} />
          </MotionItem>
        ) : (
          <MotionItem
            key={category.id}
            preset="chip"
            className="min-h-7 max-w-full justify-center rounded-[10px] bg-peach px-2.5 py-1"
          >
            <Text className="text-[11px]" tone="icon">
              {category.name}
            </Text>
          </MotionItem>
        ),
      )}
    </View>
  );
}
