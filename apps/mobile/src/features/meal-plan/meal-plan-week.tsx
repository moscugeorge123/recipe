import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronLeft, ChevronRight, Ellipsis, Plus } from 'lucide-react-native';

import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { EmptyStatePanel } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { MealEntryChip } from '@/features/meal-plan/meal-entry-chip';
import {
  useClearMealPlanWeek,
  useDeleteMealPlanEntry,
  useMealPlan,
  useReorderMealPlan,
} from '@/features/meal-plan/hooks';
import { SlotPopover } from '@/features/meal-plan/slot-popover';
import {
  MealSlot as MealSlotEnum,
  type MealPlanEntryView,
  type MealSlot,
} from '@/features/meal-plan/types';
import {
  buildMoveToDayPayload,
  daysOfWeek,
  entriesForDay,
  formatWeekLabel,
  weekdayLabel,
  weekdayWithDay,
} from '@/features/meal-plan/week';
import { hapticLight } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { mapUserError } from '@/lib/user-error';
import { useMealPlanWeekStore } from '@/stores/meal-plan-week-store';
import { useUiStore } from '@/stores/ui-store';
import { fonts, colors } from '@/theme/tokens';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function MealPlanWeek() {
  const params = useLocalSearchParams<{ addRecipeId?: string | string[] }>();
  const addRecipeId = firstParam(params.addRecipeId);
  const weekStart = useMealPlanWeekStore((state) => state.weekStart);
  const shiftWeek = useMealPlanWeekStore((state) => state.shiftWeek);
  const plan = useMealPlan(weekStart);
  const removeEntry = useDeleteMealPlanEntry();
  const reorder = useReorderMealPlan();
  const clearWeek = useClearMealPlanWeek();
  const catalog = useCatalog();
  const reduced = useReducedMotion();
  const showToast = useUiStore((state) => state.showToast);
  const [popover, setPopover] = useState<{
    date: string;
    left: number;
    top: number;
  } | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(
    addRecipeId ?? null,
  );
  const [seenAddRecipeId, setSeenAddRecipeId] = useState(addRecipeId ?? null);
  if (addRecipeId && addRecipeId !== seenAddRecipeId) {
    setSeenAddRecipeId(addRecipeId);
    setPendingRecipeId(addRecipeId);
  }
  const rootRef = useRef<View | null>(null);
  const dayRefs = useRef<Record<string, View | null>>({});
  const addRefs = useRef<Record<string, View | null>>({});

  const days = useMemo(() => daysOfWeek(weekStart), [weekStart]);
  const entries = plan.data?.items ?? [];
  const empty = entries.length === 0 && !plan.isLoading && !plan.isError;

  const closePopover = () => setPopover(null);

  const openSlotPopover = (date: string) => {
    setPopover({ date, left: 16, top: 120 });
    const button = addRefs.current[date];
    const root = rootRef.current;
    if (!button || !root) {
      return;
    }
    button.measureInWindow((bx, by, bw, bh) => {
      root.measureInWindow((sx, sy) => {
        const menuWidth = 160;
        const gap = 8;
        const left = Math.max(12, bx - sx - menuWidth - gap);
        const top = by - sy + Math.max(0, (bh - 44) / 2);
        setPopover({ date, left, top });
      });
    });
  };

  const openAdd = (date: string, slot: MealSlot, recipeId?: string) => {
    const query = recipeId ? { date, slot, recipeId } : { date, slot };
    router.push({ pathname: '/plan/add', params: query } as never);
  };

  const titleFor = (entry: MealPlanEntryView): string => {
    if (entry.kind === 'NOTE') {
      return entry.note ?? 'Note';
    }
    return catalog.get(entry.recipeId ?? '')?.title ?? 'Recipe';
  };

  const dropOnDay = (
    movingId: string,
    absoluteX: number,
    absoluteY: number,
  ) => {
    const checks = days.map(
      (date) =>
        new Promise<string | null>((resolve) => {
          const node = dayRefs.current[date];
          if (!node) {
            resolve(null);
            return;
          }
          node.measureInWindow((x, y, width, height) => {
            const hitX = absoluteX >= x && absoluteX <= x + width;
            const hitY = absoluteY >= y && absoluteY <= y + height;
            resolve(hitX && hitY ? date : null);
          });
        }),
    );
    void Promise.all(checks).then((hits) => {
      const targetDate = hits.find((date): date is string => !!date);
      if (!targetDate) {
        return;
      }
      const payload = buildMoveToDayPayload(
        entries,
        movingId,
        targetDate,
        weekStart,
      );
      if (!payload) {
        return;
      }
      void reorder.mutateAsync(payload).catch((error: unknown) => {
        showToast({
          text: mapUserError(error, 'mealPlan').message,
          glyph: '!',
        });
      });
    });
  };

  const runClearWeek = () => {
    setOverflow(false);
    const ids = entries.map((entry) => entry.id);
    if (!ids.length || clearWeek.isPending) {
      return;
    }
    void clearWeek
      .mutateAsync(ids)
      .then(() => {
        showToast({ text: 'Cleared this week', glyph: '✓' });
      })
      .catch((error: unknown) => {
        showToast({
          text: mapUserError(error, 'mealPlan').message,
          glyph: '!',
        });
      });
  };

  return (
    <Screen>
      <View ref={rootRef} className="flex-1" collapsable={false}>
        <View className="flex-row items-start justify-between px-5 pb-2 pt-1">
          <Text variant="display" accessibilityRole="header" className="flex-1">
            Meal Plan
          </Text>
          <IconButton
            accessibilityLabel="More"
            onPress={() => setOverflow(true)}
          >
            <Ellipsis size={22} color={colors.espresso} strokeWidth={2} />
          </IconButton>
        </View>

        <View className="flex-row items-center justify-between px-5 pb-3">
          <IconButton
            accessibilityLabel="Previous week"
            onPress={() => {
              closePopover();
              shiftWeek(-1);
            }}
          >
            <ChevronLeft size={22} color={colors.espresso} strokeWidth={2.2} />
          </IconButton>
          <Text
            className="flex-1 text-center text-[14px]"
            style={{ fontFamily: fonts.manrope600 }}
            accessibilityRole="header"
          >
            {formatWeekLabel(weekStart)}
          </Text>
          <IconButton
            accessibilityLabel="Next week"
            onPress={() => {
              closePopover();
              shiftWeek(1);
            }}
          >
            <ChevronRight size={22} color={colors.espresso} strokeWidth={2.2} />
          </IconButton>
        </View>

        {pendingRecipeId ? (
          <Text variant="caption" className="px-5 pb-2">
            Pick a day for this recipe
          </Text>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-10"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={closePopover}
        >
          {plan.data?.fromCache ? (
            <StaleIndicator
              className="pb-2"
              message="Showing last saved plan. Retry to refresh."
            />
          ) : null}
          {plan.isError ? (
            <View className="pb-2">
              <InlineErrorPanel
                message={
                  entries.length
                    ? 'Couldn’t refresh your week. Showing what we have.'
                    : mapUserError(plan.error ?? new Error('offline'), 'mealPlan')
                        .message
                }
                retryLabel="Retry"
                retrying={plan.isFetching}
                onRetry={() => {
                  void plan.refetch();
                }}
              />
            </View>
          ) : null}
          {plan.isLoading && entries.length === 0 && !plan.isError ? (
            <ContentSkeleton shape="list" />
          ) : null}
          {empty ? (
            <View className="pb-4">
              <EmptyStatePanel title="Let’s plan your week" />
            </View>
          ) : null}

          {days.map((date) => {
            const dayEntries = entriesForDay(entries, date);
            return (
              <View
                key={date}
                ref={(node) => {
                  dayRefs.current[date] = node;
                }}
                collapsable={false}
                className="border-b border-crust py-3"
                accessibilityLabel={weekdayWithDay(date)}
              >
                <View className="flex-row items-center justify-between pb-2">
                  <Text style={{ fontFamily: fonts.manrope700 }}>
                    {weekdayWithDay(date)}
                  </Text>
                  <View
                    ref={(node) => {
                      addRefs.current[date] = node;
                    }}
                    collapsable={false}
                  >
                    <IconButton
                      accessibilityLabel={`Add to ${weekdayLabel(date)}`}
                      onPress={() => {
                        hapticLight().catch(() => undefined);
                        if (pendingRecipeId) {
                          const recipeId = pendingRecipeId;
                          setPendingRecipeId(null);
                          openAdd(date, MealSlotEnum.DINNER, recipeId);
                          return;
                        }
                        if (popover?.date === date) {
                          closePopover();
                          return;
                        }
                        openSlotPopover(date);
                      }}
                    >
                      <Plus size={22} color={colors.espresso} strokeWidth={2.2} />
                    </IconButton>
                  </View>
                </View>
                {dayEntries.map((entry) => (
                  <MealEntryChip
                    key={entry.id}
                    entry={entry}
                    title={titleFor(entry)}
                    dragEnabled={!reduced}
                    onRemove={() => {
                      void removeEntry
                        .mutateAsync(entry.id)
                        .catch((error: unknown) => {
                          showToast({
                            text: mapUserError(error, 'mealPlan').message,
                            glyph: '!',
                          });
                        });
                    }}
                    onDrop={(x, y) => dropOnDay(entry.id, x, y)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>

        {popover ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss meal picker"
              onPress={closePopover}
              className="absolute inset-0 z-30"
            />
            <View
              pointerEvents="box-none"
              className="absolute z-40"
              style={{ left: popover.left, top: popover.top }}
            >
              <SlotPopover
                onPick={(slot) => {
                  const date = popover.date;
                  closePopover();
                  openAdd(date, slot, pendingRecipeId ?? undefined);
                  setPendingRecipeId(null);
                }}
              />
            </View>
          </>
        ) : null}

        <Sheet
          visible={overflow}
          onClose={() => setOverflow(false)}
          accessibilityLabel="More"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear this week"
            onPress={runClearWeek}
            className="min-h-11 justify-center py-3"
          >
            <Text tone="icon">Clear this week</Text>
          </Pressable>
        </Sheet>
      </View>
    </Screen>
  );
}
