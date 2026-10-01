import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useClearMealPlanWeek, useMealPlan } from '@/features/meal-plan/hooks';
import type { MealPlanEntryView } from '@/features/meal-plan/types';
import { mealPlanKeys } from '@/features/query-keys';
import { announce } from '@/lib/announce';
import { presentGroceryPick } from '@/tortie/data/grocery-pick';
import { mondayAt, usePlan } from '@/tortie/data/plan';
import {
  displayedPlanEntryIds,
  isMealPlanWeekItemsCache,
  omitPlanEntries,
  recipeIdsForPlanEntries,
} from '@/tortie/data/plan-slot';
import { allVisibleSelected } from '@/tortie/data/selection';
import { useFrame } from '@/tortie/frame';
import { plz } from '@/tortie/lib/fmt';
import { useMotion } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const ACTS = [
  ['add_shopping_cart', 'Add ingredients to groceries', C.green],
  ['delete', 'Remove', C.terra],
] as const;

function cachedPlanEntries(
  client: ReturnType<typeof useQueryClient>,
): MealPlanEntryView[] {
  const out: MealPlanEntryView[] = [];
  for (const [, data] of client.getQueriesData({
    queryKey: mealPlanKeys.all,
  })) {
    if (isMealPlanWeekItemsCache(data)) out.push(...data.items);
    else if (Array.isArray(data)) {
      for (const row of data) {
        if (
          row &&
          typeof row === 'object' &&
          typeof (row as MealPlanEntryView).id === 'string'
        ) {
          out.push(row as MealPlanEntryView);
        }
      }
    }
  }
  return out;
}

/**
 * Selection chrome over the meal plan. Same top and bottom bars as the
 * cookbook, with add-to-groceries and remove.
 */
export function PlanSelectionBars() {
  const f = useFrame();
  const { m, reduced } = useMotion();
  const ms = Math.round(520 * m);
  const sel = useNav((s) => s.sel);
  const tab = useNav((s) => s.tab);
  const active = sel != null && tab === 'plan';
  const wk = usePlan((s) => s.wk);
  const monday = mondayAt(wk);
  const plan = useMealPlan(monday);
  const client = useQueryClient();
  const clearWeek = useClearMealPlanWeek();
  const busy = useRef(false);
  const [topH, setTopH] = useState(160);
  const items = plan.data?.from === monday ? plan.data.items : undefined;
  const visible = displayedPlanEntryIds(monday, items);
  const n = sel?.length ?? 0;
  const all = !!sel && allVisibleSelected(sel, visible);
  const prevN = useRef<number | null>(null);

  useEffect(() => {
    const count = active ? (sel?.length ?? null) : null;
    if (count != null && count !== prevN.current) announce(`${count} selected`);
    prevN.current = count;
  }, [active, sel]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useNav.getState();
      if (s.sel == null || s.tab !== 'plan') return;
      e.preventDefault();
      s.clearSel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const top = useAnimatedStyle(() => ({
    opacity: reduced ? tw(active ? 1 : 0, ms) : 1,
    transform: [{ translateY: reduced ? 0 : tw(active ? 0 : -topH, ms) }],
  }));
  const bot = useAnimatedStyle(() => ({
    opacity: reduced ? tw(active ? 1 : 0, ms) : 1,
    transform: [{ translateY: reduced ? 0 : tw(active ? 0 : f.tabBarH, ms) }],
  }));

  const onGroceries = async () => {
    const entryIds = useNav.getState().sel;
    if (!entryIds?.length || busy.current) return;
    busy.current = true;
    try {
      const recipeIds = recipeIdsForPlanEntries(
        cachedPlanEntries(client),
        entryIds,
      );
      const opened = await presentGroceryPick(client, recipeIds);
      if (opened) useNav.getState().clearSel();
    } finally {
      busy.current = false;
    }
  };

  const onRemove = async () => {
    const entryIds = useNav.getState().sel;
    if (!entryIds?.length || busy.current) return;
    busy.current = true;
    const ids = [...entryIds];
    for (const [key, data] of client.getQueriesData({
      queryKey: mealPlanKeys.all,
    })) {
      const next = omitPlanEntries(data, ids);
      if (next) client.setQueryData(key, next);
    }
    useNav.getState().clearSel();
    try {
      await clearWeek.mutateAsync(ids);
      toast(plz(ids.length, 'meal') + ' removed');
    } catch {
      void client.invalidateQueries({ queryKey: mealPlanKeys.all });
      toast('Couldn’t remove those meals — try again.');
    } finally {
      busy.current = false;
    }
  };

  const hidden = !active;
  return (
    <>
      <Animated.View
        pointerEvents={hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        onLayout={(e) => setTopH(e.nativeEvent.layout.height)}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 21,
            paddingTop: f.status,
            paddingHorizontal: 12,
            paddingBottom: 10,
            backgroundColor: C.bg,
            boxShadow: '0 1px 0 #e1e3de, 0 10px 24px -14px rgba(44,52,45,.3)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          },
          top,
        ]}
      >
        <Press
          onPress={() => useNav.getState().clearSel()}
          accessibilityLabel="Cancel selection"
          scale={0.9}
          ms={200}
          easing={CSS_EASE}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={24} color={C.ink} />
        </Press>
        <T
          numberOfLines={1}
          style={[
            serif(22, 500, C.ink, { letterSpacing: em(22, -0.01) }),
            { flex: 1, minWidth: 0 },
          ]}
        >
          {n} selected
        </T>
        <Press
          onPress={() => {
            if (all) useNav.getState().clearSel();
            else if (visible.length) useNav.getState().selectIds(visible);
          }}
          style={{
            height: 44,
            paddingHorizontal: 12,
            borderRadius: 99,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(14, 700, C.green)}>
            {all ? 'Deselect all' : 'Select all'}
          </T>
        </Press>
      </Animated.View>
      <Animated.View
        pointerEvents={hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 22,
            height: f.tabBarH,
            paddingHorizontal: 10,
            paddingBottom: f.tabBarPad,
            backgroundColor: C.bg,
            borderTopWidth: 1,
            borderTopColor: C.line,
          },
          bot,
        ]}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {ACTS.map(([icon, label, color]) => (
            <Press
              key={label}
              onPress={() => {
                if (label === 'Remove') void onRemove();
                else void onGroceries();
              }}
              scale={0.92}
              ms={200}
              easing={CSS_EASE}
              accessibilityLabel={label}
              style={{
                flex: 1,
                minWidth: 0,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 8,
                gap: 4,
              }}
            >
              <Glyph name={icon} size={24} color={color} />
              <T
                numberOfLines={2}
                style={[
                  sans(11, 600, C.ink),
                  { textAlign: 'center', lineHeight: 13 },
                ]}
              >
                {label}
              </T>
            </Press>
          ))}
        </View>
      </Animated.View>
    </>
  );
}
