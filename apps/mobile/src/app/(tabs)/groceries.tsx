import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Ellipsis, Plus, Share2 } from 'lucide-react-native';

import { Chip } from '@/components/ui/chip';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { EmptyStatePanel } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import { useMealPlan } from '@/features/meal-plan/hooks';
import { visibleGroceryItems } from '@/features/meal-plan/week';
import { PantryPanel } from '@/features/pantry/pantry-panel';
import {
  formatGroceryQty,
  groupByAisle,
  shoppingListShareText,
} from '@/features/shopping-list/aisle';
import { GroceryAisleRow } from '@/features/shopping-list/grocery-aisle-row';
import {
  useClearDone,
  usePatchShoppingItem,
  useShoppingList,
} from '@/features/shopping-list/hooks';
import { mapUserError } from '@/lib/user-error';
import { useMealPlanWeekStore } from '@/stores/meal-plan-week-store';
import { useUiStore } from '@/stores/ui-store';
import { colors } from '@/theme/tokens';

type GroceriesSegment = 'pantry' | 'shopping';

export default function GroceriesScreen() {
  const [segment, setSegment] = useState<GroceriesSegment>('shopping');
  const [overflow, setOverflow] = useState(false);
  const list = useShoppingList();
  const weekStart = useMealPlanWeekStore((state) => state.weekStart);
  const mealPlan = useMealPlan(weekStart);
  const patchItem = usePatchShoppingItem();
  const clearDone = useClearDone();
  const showToast = useUiStore((state) => state.showToast);
  const weekEntryIds = new Set(
    (mealPlan.data?.items ?? []).map((entry) => entry.id),
  );
  const items = visibleGroceryItems(list.data?.items ?? [], {
    weekEntryIds,
    filterMealPlan: mealPlan.isSuccess || mealPlan.isError,
  });
  const groups = groupByAisle(items);

  const shareList = () => {
    const message = shoppingListShareText(items);
    void Share.share({
      title: 'Grocery List',
      message: message || 'Grocery List',
    }).catch(() => undefined);
  };

  const runClearPurchased = () => {
    setOverflow(false);
    if (clearDone.isPending) {
      return;
    }
    void clearDone
      .mutateAsync()
      .then((result) => {
        showToast({
          text: result.count
            ? `Cleared ${result.count} purchased item${result.count === 1 ? '' : 's'}`
            : 'Nothing purchased to clear',
          glyph: '✓',
        });
      })
      .catch((error: unknown) => {
        showToast({
          text: mapUserError(error, 'shopping').message,
          glyph: '!',
        });
      });
  };

  return (
    <Screen>
      <View className="flex-row items-start justify-between px-5 pb-2 pt-1">
        <Text variant="display" accessibilityRole="header" className="flex-1">
          Grocery List
        </Text>
        <View className="flex-row items-center gap-1">
          {segment === 'shopping' ? (
            <IconButton
              accessibilityLabel="Add items"
              onPress={() => router.push('/groceries/add' as Href)}
            >
              <Plus size={22} color={colors.espresso} strokeWidth={2.2} />
            </IconButton>
          ) : null}
          <IconButton
            accessibilityLabel="Share list"
            onPress={shareList}
          >
            <Share2 size={20} color={colors.espresso} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            accessibilityLabel="More"
            onPress={() => setOverflow(true)}
          >
            <Ellipsis size={22} color={colors.espresso} strokeWidth={2} />
          </IconButton>
        </View>
      </View>
      <View className="flex-row gap-2 px-5 pb-3">
        <Chip
          label="Pantry"
          selected={segment === 'pantry'}
          onPress={() => setSegment('pantry')}
        />
        <Chip
          label="Shopping list"
          selected={segment === 'shopping'}
          onPress={() => setSegment('shopping')}
        />
      </View>
      <KeyboardAwareScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {segment === 'pantry' ? (
          <PantryPanel compact />
        ) : (
          <View>
            {list.data?.fromCache ? (
              <StaleIndicator
                className="pb-2"
                message="Showing last saved list. Retry to refresh."
              />
            ) : null}
            {list.isError ? (
              <View className="pb-2">
                <InlineErrorPanel
                  message={
                    items.length
                      ? 'Couldn’t refresh your list. Showing what we have.'
                      : mapUserError(
                          list.error ?? new Error('offline'),
                          'shopping',
                        ).message
                  }
                  retryLabel="Retry"
                  retrying={list.isFetching}
                  onRetry={() => {
                    void list.refetch();
                  }}
                />
              </View>
            ) : null}
            {list.isLoading && items.length === 0 && !list.isError ? (
              <ContentSkeleton shape="list" />
            ) : items.length === 0 && !list.isError ? (
              <EmptyStatePanel
                title="Nothing on your list yet. Add items or send ingredients from a recipe."
                actionLabel="Add items"
                onAction={() => router.push('/groceries/add' as Href)}
              />
            ) : (
              groups.map((group) => (
                <View key={group.category} className="pt-2">
                  <Text variant="section" className="pb-1 pt-3">
                    {group.label.toUpperCase()}
                  </Text>
                  {group.items.map((item) => (
                    <GroceryAisleRow
                      key={item.id}
                      emoji={item.emoji ?? '🛒'}
                      name={item.name}
                      quantityLabel={formatGroceryQty(item.quantity, item.unit)}
                      done={item.done}
                      onToggleDone={() => {
                        patchItem.mutate({
                          id: item.id,
                          body: { done: !item.done },
                        });
                      }}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        )}
      </KeyboardAwareScrollView>
      <Sheet
        visible={overflow}
        onClose={() => setOverflow(false)}
        accessibilityLabel="More"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear purchased"
          onPress={runClearPurchased}
          className="min-h-11 justify-center border-b border-crust py-3"
        >
          <Text tone="icon">Clear purchased</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
