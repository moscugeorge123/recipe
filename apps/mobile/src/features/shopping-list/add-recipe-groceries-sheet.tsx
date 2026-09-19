import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { formatQty } from '@/features/recipes/plan';
import type { RecipeIngredientView } from '@/features/recipes/types';
import { groupByAisle } from '@/features/shopping-list/aisle';
import {
  isOnShoppingList,
  shoppingListKeysFrom,
  toShoppingWriteItems,
} from '@/features/shopping-list/match';
import type { ShoppingListWriteItem } from '@/features/shopping-list/types';
import { isHave } from '@/stores/contracts';
import { colors, fonts } from '@/theme/tokens';

type GroceryPreviewItem = {
  canonicalName: string | null;
  name: string;
  done?: boolean;
};

type AddRecipeGroceriesSheetProps = {
  visible: boolean;
  recipeId: string;
  ingredients: RecipeIngredientView[];
  pantryKeys: readonly string[];
  groceryItems?: GroceryPreviewItem[] | null;
  multiplier: number;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (items: ShoppingListWriteItem[]) => void;
};

type SheetBodyProps = Omit<AddRecipeGroceriesSheetProps, 'visible'>;

type SheetRow = {
  ingredient: RecipeIngredientView;
  inPantry: boolean;
  onList: boolean;
};

export function AddRecipeGroceriesSheet({
  visible,
  onClose,
  ...body
}: AddRecipeGroceriesSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      expandable
      accessibilityLabel="Add to groceries"
    >
      {visible ? (
        <AddRecipeGroceriesSheetBody onClose={onClose} {...body} />
      ) : null}
    </Sheet>
  );
}

function AddRecipeGroceriesSheetBody({
  recipeId,
  ingredients,
  pantryKeys,
  groceryItems,
  multiplier,
  pending = false,
  onClose,
  onConfirm,
}: SheetBodyProps) {
  const groceryKeys = useMemo(
    () => shoppingListKeysFrom(groceryItems),
    [groceryItems],
  );
  const rows = useMemo<SheetRow[]>(
    () =>
      ingredients.map((ingredient) => {
        const inPantry = isHave(
          ingredient.name,
          pantryKeys,
          ingredient.canonicalName,
        );
        return {
          ingredient,
          inPantry,
          onList: !inPantry && isOnShoppingList(ingredient, groceryKeys),
        };
      }),
    [groceryKeys, ingredients, pantryKeys],
  );
  const eligibleIds = useMemo(
    () => rows.filter((row) => !row.inPantry).map((row) => row.ingredient.id),
    [rows],
  );
  const [selectedIds, setSelectedIds] = useState(() => new Set(eligibleIds));

  const groups = useMemo(
    () =>
      groupByAisle(
        rows.map((row) => ({
          ...row,
          category: row.ingredient.category,
        })),
      ),
    [rows],
  );

  const selectedCount = eligibleIds.filter((id) => selectedIds.has(id)).length;
  const canAdd = selectedCount > 0 && !pending;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const confirm = () => {
    const selected = rows
      .filter((row) => !row.inPantry && selectedIds.has(row.ingredient.id))
      .map((row) => row.ingredient);
    onConfirm(toShoppingWriteItems(recipeId, selected, multiplier));
  };

  return (
    <View style={styles.body}>
      <Text variant="title" className="pb-3">
        Add to groceries
      </Text>
      <View style={styles.listWrap}>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.category} className="pt-2">
              <Text variant="section" className="pb-1 pt-3">
                {group.label.toUpperCase()}
              </Text>
              {group.items.map((row) => (
                <IngredientSheetRow
                  key={row.ingredient.id}
                  row={row}
                  multiplier={multiplier}
                  selected={selectedIds.has(row.ingredient.id)}
                  pending={pending}
                  onToggle={() => toggle(row.ingredient.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
      <View className="flex-row gap-2.5 pt-5">
        <Button
          label="Cancel"
          variant="ghost"
          className="flex-1"
          disabled={pending}
          onPress={onClose}
        />
        <Button
          label={pending ? 'Working…' : 'Add to groceries'}
          variant="primary"
          className="flex-[1.4]"
          disabled={!canAdd}
          onPress={confirm}
        />
      </View>
    </View>
  );
}

function IngredientSheetRow({
  row,
  multiplier,
  selected,
  pending,
  onToggle,
}: {
  row: SheetRow;
  multiplier: number;
  selected: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const { ingredient, inPantry, onList } = row;
  const qty = formatQty(ingredient.quantity, ingredient.unit, multiplier);
  const body = (
    <View className="min-h-11 flex-row items-center gap-3 border-b border-crust px-2 py-3">
      {inPantry ? (
        <View className="h-6 w-6" />
      ) : (
        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={{
            borderWidth: 1.5,
            borderColor: selected ? colors.cta : colors.crust,
            backgroundColor: selected ? colors.cta : 'transparent',
          }}
        >
          {selected ? (
            <Text className="text-[11px]" tone="inverse">
              ✓
            </Text>
          ) : null}
        </View>
      )}
      <Text className="w-7 text-center text-[16px]">
        {ingredient.emoji ?? '•'}
      </Text>
      <Text className="min-w-[70px]" style={{ fontFamily: fonts.manrope700 }}>
        {qty}
      </Text>
      <Text className="flex-1">{ingredient.name}</Text>
      {onList ? (
        <Check
          size={18}
          color={colors.paprikaPressed}
          strokeWidth={2.4}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
    </View>
  );

  if (inPantry) {
    return (
      <View
        accessibilityLabel={`${ingredient.name}, in pantry`}
        style={{ opacity: 0.45 }}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, busy: pending }}
      accessibilityLabel={
        onList ? `${ingredient.name}, on your list` : ingredient.name
      }
      disabled={pending}
      onPress={onToggle}
      style={{
        backgroundColor: onList ? colors.paprikaSoft : undefined,
      }}
    >
      {body}
    </Pressable>
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
