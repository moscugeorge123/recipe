import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useMealPlan } from '@/features/meal-plan/hooks';
import { addUtcDays, localTodayIso } from '@/features/meal-plan/week';
import { mondayOfWeek } from '@/features/meal-plan/types';
import { useCook } from '@/tortie/cook-store';
import { useCookbook } from '@/tortie/data/cookbook';
import { presentGroceryPick } from '@/tortie/data/grocery-pick';
import {
  currentMonday,
  daysBetween,
  isoParts,
  MEAL_KEYS,
  mealSlot,
  mondayAt,
  todayIndex,
  usePlan,
  usePlanToday,
  usePlannedDates,
  usePlanWeek,
  useRecipeLite,
  weekName,
  weekRange,
  type MealKey,
} from '@/tortie/data/plan';
import { findSlotRecipeEntry } from '@/tortie/data/plan-slot';
import { useFrame } from '@/tortie/frame';
import { DAYLETTERS, DAYNAMES, fmtT, MON } from '@/tortie/lib/fmt';
import { toast, useNav } from '@/tortie/nav-store';
import {
  cardWebStyle,
  onRecipeCardPress,
  onRecipeSelectAction,
  SelMark,
  useRecipeLongPress,
} from '@/tortie/screens/cookbook-select';
import { PlanDaySwipe } from '@/tortie/screens/plan-day-swipe';
import { C, CSS_EASE, EASE, SH } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Grabber } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { Stagger } from '@/tortie/ui/stagger';
import { TabScroll } from '@/tortie/ui/tab-scroll';
import { em, sans, serif, T } from '@/tortie/ui/text';

const SLOTS: [MealKey, string, string][] = [
  ['b', 'Breakfast', 'wb_twilight'],
  ['l', 'Lunch', 'light_mode'],
  ['d', 'Dinner', 'dark_mode'],
];

const usePlanOn = () => useNav((s) => s.tab === 'plan' && s.mounted);

export function PlanScreen() {
  usePlanToday();
  const on = usePlanOn();
  const wk = usePlan((s) => s.wk);
  const day = usePlan((s) => s.day);
  const monday = mondayAt(wk);
  const { planned, week } = usePlanWeek(monday);
  const dayHasRecipe = MEAL_KEYS.some((k) => week[day]?.[k]);
  return (
    <TabScroll
      header={(compact) => (
        <PlanHeader
          compact={compact}
          on={on}
          sub={`${weekRange(monday)} · ${planned} of 21 meals planned`}
        />
      )}
    >
      <PlanDaySwipe>
        <WeekControls on={on} />
        <DayStrip on={on} />
        <DayContent on={on} />
        {dayHasRecipe ? <ShopCard on={on} /> : null}
      </PlanDaySwipe>
    </TabScroll>
  );
}

function PlanHeader({
  compact,
  on,
  sub,
}: {
  compact: boolean;
  on: boolean;
  sub: string;
}) {
  const pad = useAnimatedStyle(() => ({
    paddingTop: tw(compact ? 10 : 8, 220, CSS_EASE),
    paddingBottom: tw(compact ? 10 : 18, 220, CSS_EASE),
  }));
  const title = useAnimatedStyle(() => ({
    fontSize: tw(compact ? 20 : 36, 220, CSS_EASE),
    lineHeight: tw(compact ? 22 : 39.6, 220, CSS_EASE),
    letterSpacing: tw(compact ? -0.4 : -0.72, 220, CSS_EASE),
  }));
  const subA = useAnimatedStyle(() => ({
    opacity: tw(compact ? 0 : 1, 200, CSS_EASE),
    height: tw(compact ? 0 : 20, 220, CSS_EASE),
    marginTop: tw(compact ? 0 : 4, 220, CSS_EASE),
  }));
  return (
    <Stagger i={0} on={on}>
      <Animated.View style={pad}>
        <Animated.Text allowFontScaling={false} style={[serif(36, 500), title]}>
          Meal plan
        </Animated.Text>
        <Animated.View style={[{ overflow: 'hidden' }, subA]}>
          <T
            numberOfLines={1}
            style={[sans(14, 400, C.ink2), { lineHeight: 20 }]}
          >
            {sub}
          </T>
        </Animated.View>
      </Animated.View>
    </Stagger>
  );
}

function RoundBtn({
  icon,
  size,
  color,
  onPress,
  label,
}: {
  icon: string;
  size: number;
  color: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.9}
      easing={CSS_EASE}
      bg={C.white}
      pressedBg={C.surface2}
      accessibilityLabel={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={size} color={color} />
    </Press>
  );
}

function WeekControls({ on }: { on: boolean }) {
  const wk = usePlan((s) => s.wk);
  const wkOut = usePlan((s) => s.wkOut);
  const wkDir = usePlan((s) => s.wkDir);
  const setWeek = usePlan((s) => s.setWeek);
  const openCal = usePlan((s) => s.openCal);
  const lbl = useAnimatedStyle(() => ({
    opacity: tw(wkOut ? 0 : 1, 160, CSS_EASE),
    transform: [{ translateX: tw(wkOut ? -wkDir * 10 : 0, 260, EASE) }],
  }));
  return (
    <Stagger
      i={1}
      on={on}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
        marginHorizontal: 2,
        marginBottom: 12,
      }}
    >
      <Press
        onPress={openCal}
        style={{ flex: 1, minWidth: 0 }}
        animatedStyle={lbl}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <T style={sans(15, 700)}>{weekName(wk)}</T>
          <Glyph name="expand_more" size={20} color={C.green} />
        </View>
        <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
          {weekRange(mondayAt(wk))}
        </T>
      </Press>
      {wk !== 0 ? (
        <Press
          onPress={() => setWeek(0)}
          scale={0.95}
          easing={CSS_EASE}
          style={{
            height: 36,
            paddingLeft: 10,
            paddingRight: 12,
            borderRadius: 99,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.white,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Glyph name="today" size={18} color={C.green} />
          <T style={sans(13, 700, C.green)}>Today</T>
        </Press>
      ) : null}
      <RoundBtn
        icon="calendar_month"
        size={20}
        color={C.green}
        onPress={openCal}
        label="Pick a day from the month"
      />
      <RoundBtn
        icon="chevron_left"
        size={22}
        color={C.ink}
        onPress={() => setWeek(wk - 1)}
        label="Previous week"
      />
      <RoundBtn
        icon="chevron_right"
        size={22}
        color={C.ink}
        onPress={() => setWeek(wk + 1)}
        label="Next week"
      />
    </Stagger>
  );
}

function DayStrip({ on }: { on: boolean }) {
  const wk = usePlan((s) => s.wk);
  const day = usePlan((s) => s.day);
  const setDay = usePlan((s) => s.setDay);
  const monday = mondayAt(wk);
  const tIdx = todayIndex();
  return (
    <Stagger
      i={1}
      on={on}
      style={{
        flexDirection: 'row',
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 16,
        padding: 5,
      }}
    >
      {DAYLETTERS.map((l, i) => (
        <DayBtn
          key={i}
          letter={l}
          n={isoParts(addUtcDays(monday, i)).d}
          on={i === day}
          dot={
            wk === 0 && i === tIdx
              ? i === day
                ? C.bg
                : C.terra
              : 'transparent'
          }
          onPress={() => setDay(i)}
        />
      ))}
    </Stagger>
  );
}

function DayBtn({
  letter,
  n,
  on,
  dot,
  onPress,
}: {
  letter: string;
  n: number;
  on: boolean;
  dot: string;
  onPress: () => void;
}) {
  const wkOut = usePlan((s) => s.wkOut);
  const wkDir = usePlan((s) => s.wkDir);
  const a = useAnimatedStyle(() => ({
    opacity: tw(wkOut ? 0 : 1, 160, CSS_EASE),
    transform: [{ translateX: tw(wkOut ? -wkDir * 10 : 0, 260, EASE) }],
    backgroundColor: tw(on ? C.green : 'rgba(50,83,60,0)', 260, CSS_EASE),
  }));
  const col = useAnimatedStyle(() => ({
    color: tw(on ? C.bg : C.ink, 300, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        zIndex: 1,
        paddingTop: 9,
        paddingBottom: 8,
        alignItems: 'center',
        gap: 4,
        borderRadius: 12,
      }}
      animatedStyle={a}
    >
      <Animated.Text
        allowFontScaling={false}
        style={[sans(11, 600), { opacity: 0.8 }, col]}
      >
        {letter}
      </Animated.Text>
      <Animated.Text allowFontScaling={false} style={[sans(17, 700), col]}>
        {n}
      </Animated.Text>
      <View
        style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dot }}
      />
    </Press>
  );
}

function DayContent({ on }: { on: boolean }) {
  const wk = usePlan((s) => s.wk);
  const day = usePlan((s) => s.day);
  const wkOut = usePlan((s) => s.wkOut);
  const wkDir = usePlan((s) => s.wkDir);
  const dayOut = usePlan((s) => s.dayOut);
  const dayDir = usePlan((s) => s.dayDir);
  const monday = mondayAt(wk);
  const { week } = usePlanWeek(monday);
  const pd = week[day] ?? { b: null, l: null, d: null };
  const p = isoParts(addUtcDays(monday, day));
  const title =
    DAYNAMES[day] +
    (wk === 0 && day === todayIndex()
      ? ' · Today'
      : ' · ' + MON[p.m] + ' ' + p.d);
  const dc = MEAL_KEYS.filter((k) => pd[k]).length;
  const fx = useAnimatedStyle(() => ({
    opacity: tw(dayOut || wkOut ? 0 : 1, 170, CSS_EASE),
    transform: [
      {
        translateX: tw(
          wkOut ? -wkDir * 14 : dayOut ? -dayDir * 14 : 0,
          260,
          EASE,
        ),
      },
    ],
  }));
  return (
    <>
      <Stagger
        i={2}
        on={on}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginTop: 24,
          marginHorizontal: 2,
          marginBottom: 12,
        }}
      >
        <T style={serif(22, 600)}>{title}</T>
        <T style={sans(13, 400, C.ink2)}>{`${dc} of 3 planned`}</T>
      </Stagger>
      <Animated.View style={[{ gap: 10 }, fx]}>
        {SLOTS.map(([k, label, icon], i) => (
          <Stagger key={k} i={2 + i} on={on}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginHorizontal: 4,
                marginBottom: 6,
              }}
            >
              <Glyph name={icon} size={16} color={C.ink2} />
              <T
                style={[
                  sans(11, 700, C.ink2),
                  { letterSpacing: em(11, 0.06), textTransform: 'uppercase' },
                ]}
              >
                {label}
              </T>
            </View>
            {pd[k] ? (
              <FilledSlot id={pd[k]} meal={k} />
            ) : (
              <EmptySlot meal={k} label={label} day={day} />
            )}
          </Stagger>
        ))}
      </Animated.View>
    </>
  );
}

function FilledSlot({ id, meal }: { id: string; meal: MealKey }) {
  const r = useRecipeLite(id);
  const openRecipe = useNav((s) => s.openRecipe);
  const wk = usePlan((s) => s.wk);
  const day = usePlan((s) => s.day);
  const monday = mondayAt(wk);
  const date = addUtcDays(monday, day);
  const slot = mealSlot(meal);
  const planQ = useMealPlan(monday);
  const entry = findSlotRecipeEntry(
    planQ.data?.from === monday ? planQ.data.items : undefined,
    date,
    slot,
    id,
  );
  const entryId = entry?.id ?? '';
  const lp = useRecipeLongPress(entryId);
  const selOn = useNav((s) => s.sel != null && s.tab === 'plan');
  const isSel = useNav((s) => !!entryId && !!s.sel?.includes(entryId));
  const open = () => openRecipe(id);

  return (
    <Press
      onLayout={entryId ? lp.onLayout : undefined}
      onPressIn={(e) => {
        if (entryId) lp.onPressIn(e);
      }}
      onPressOut={() => {
        if (entryId) lp.onPressOut();
      }}
      onTouchMove={entryId ? lp.onTouchMove : undefined}
      onTouchCancel={() => {
        if (entryId) lp.onPressOut();
      }}
      onContextMenu={lp.onContextMenu}
      onPress={() => {
        if (!entryId) {
          open();
          return;
        }
        onRecipeCardPress(entryId, open);
      }}
      scale={0.98}
      ms={220}
      accessibilityRole="button"
      accessibilityState={selOn ? { selected: isSel } : undefined}
      accessibilityActions={
        entryId ? [{ name: 'select', label: 'Select' }] : undefined
      }
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'select' && entryId)
          onRecipeSelectAction(entryId);
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 10,
          paddingRight: 14,
          backgroundColor: selOn && isSel ? '#eef2ec' : C.white,
          borderWidth: 1,
          borderColor: selOn && isSel ? C.green : C.line,
          borderRadius: 16,
          boxShadow: SH.cardSubtle,
        },
        cardWebStyle,
      ]}
    >
      <Photo
        hue={r?.hue ?? 0}
        uri={r?.uri}
        radius={16}
        style={{ width: 64, height: 64 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={[serif(17, 600), { lineHeight: 20.4 }]}>{r?.title ?? ''}</T>
        <T style={[sans(12, 400, C.ink2), { marginTop: 4 }]}>
          {r ? fmtT(r.time) + ' · ' + r.level : ''}
        </T>
      </View>
      {selOn ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SelMark on={isSel} grid={false} />
        </View>
      ) : (
        <Press
          onPress={() => {
            useCook.getState().begin(id);
            useNav.getState().openCook(id);
          }}
          scale={0.9}
          easing={CSS_EASE}
          accessibilityLabel="Cook"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: C.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="play_arrow" size={22} color={C.terra} fill />
        </Press>
      )}
    </Press>
  );
}

function EmptySlot({
  meal,
  label,
  day,
}: {
  meal: MealKey;
  label: string;
  day: number;
}) {
  return (
    <Press
      onPress={() => {
        useCookbook.getState().setCbSeg('recipes');
        usePlan.getState().startPick(day, meal, label);
        useNav.getState().goTab('cookbook');
      }}
      scale={0.98}
      easing={CSS_EASE}
      bg="transparent"
      pressedBg={C.surface2}
      style={{
        height: 62,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: C.lineStrong,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Glyph name="add" size={20} color={C.green} />
      <T style={sans(14, 600, C.green)}>{'Add ' + label.toLowerCase()}</T>
    </Press>
  );
}

function ShopCard({ on }: { on: boolean }) {
  const wk = usePlan((s) => s.wk);
  const addedWeek = usePlan((s) => s.addedWeek);
  const monday = mondayAt(wk);
  const { recipeIds, planned } = usePlanWeek(monday);
  const client = useQueryClient();
  const busy = useRef(false);
  const added = wk === 0 && addedWeek === currentMonday();

  const addWeek = async () => {
    if (busy.current) return;
    if (added) {
      useNav.getState().goTab('groceries');
      return;
    }
    if (!planned || !recipeIds.length) {
      toast('Nothing planned that week yet');
      return;
    }
    busy.current = true;
    try {
      await presentGroceryPick(client, recipeIds, {
        markWeekMonday: wk === 0 ? monday : null,
      });
    } finally {
      busy.current = false;
    }
  };

  return (
    <Stagger
      i={3}
      on={on}
      style={{
        marginTop: 26,
        backgroundColor: '#32533C',
        borderRadius: 16,
        padding: 20,
      }}
    >
      <T style={[serif(21, 500, C.bg), { lineHeight: 25.2 }]}>
        Shop for the whole week
      </T>
      <T style={[sans(14, 400, '#c5eacc'), { lineHeight: 21, marginTop: 6 }]}>
        Choose which ingredients to add. Duplicates across recipes are merged.
      </T>
      <Press
        onPress={addWeek}
        scale={0.97}
        easing={CSS_EASE}
        style={{
          alignSelf: 'flex-start',
          marginTop: 14,
          height: 46,
          paddingHorizontal: 18,
          borderRadius: 99,
          backgroundColor: C.bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Glyph
          name={added ? 'check' : 'add_shopping_cart'}
          size={20}
          color="#32533C"
        />
        <T style={sans(14, 700, '#32533C')}>
          {added ? 'Added to groceries' : 'Add week to groceries'}
        </T>
      </Press>
    </Stagger>
  );
}

type Cell = {
  key: string;
  n: number;
  vis: boolean;
  sel: boolean;
  today: boolean;
  has: boolean;
  w: number;
  di: number;
};

export function MonthPickerSheet() {
  const f = useFrame();
  const open = useNav((s) => s.cal);
  const calM = usePlan((s) => s.calM);
  const calFade = usePlan((s) => s.calFade);
  const wk = usePlan((s) => s.wk);
  const day = usePlan((s) => s.day);
  const setCalM = usePlan((s) => s.setCalM);
  const goDate = usePlan((s) => s.goDate);
  const close = () => useNav.getState().set({ cal: false });

  const now = new Date();
  const fy = new Date(now.getFullYear(), now.getMonth() + calM, 1);
  const y = fy.getFullYear();
  const m = fy.getMonth();
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nDays = new Date(y, m + 1, 0).getDate();
  const last = addUtcDays(first, nDays - 1);
  const from = mondayOfWeek(first);
  const to = addUtcDays(mondayOfWeek(last), 6);
  const planned = usePlannedDates(from, to, open);

  const rows = useMemo(() => {
    const T0 = currentMonday();
    const todayIso = localTodayIso();
    const lead = isoParts(first).wd;
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++)
      cells.push({
        key: 'l' + i,
        n: 0,
        vis: false,
        sel: false,
        today: false,
        has: false,
        w: 0,
        di: 0,
      });
    for (let dd = 1; dd <= nDays; dd++) {
      const iso = addUtcDays(first, dd - 1);
      const off = daysBetween(T0, iso);
      const w = Math.floor(off / 7);
      const di = off - w * 7;
      cells.push({
        key: iso,
        n: dd,
        vis: true,
        sel: w === wk && di === day,
        today: iso === todayIso,
        has: planned.has(iso),
        w,
        di,
      });
    }
    while (cells.length % 7)
      cells.push({
        key: 't' + cells.length,
        n: 0,
        vis: false,
        sel: false,
        today: false,
        has: false,
        w: 0,
        di: 0,
      });
    const out: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [first, nDays, wk, day, planned]);

  const fade = useAnimatedStyle(() => ({
    opacity: tw(calFade ? 0 : 1, 140, CSS_EASE),
  }));

  return (
    <Sheet
      open={open}
      onClose={close}
      z={42}
      style={{ paddingBottom: f.sheetBottom }}
    >
      <Grabber />
      <T style={[serif(26, 500), { letterSpacing: em(26, -0.01) }]}>
        Pick a day
      </T>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 18,
          marginBottom: 12,
        }}
      >
        <T style={[sans(17, 700), { flex: 1, minWidth: 0 }]}>
          {MON[m] + ' ' + y}
        </T>
        <MonthBtn
          icon="chevron_left"
          label="Previous month"
          onPress={() => setCalM(calM - 1)}
        />
        <MonthBtn
          icon="chevron_right"
          label="Next month"
          onPress={() => setCalM(calM + 1)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 2, marginBottom: 4 }}>
        {DAYLETTERS.map((h, i) => (
          <T
            key={i}
            style={[
              sans(11, 700, C.ink3),
              { flex: 1, textAlign: 'center', paddingVertical: 4 },
            ]}
          >
            {h}
          </T>
        ))}
      </View>
      <Animated.View style={[{ gap: 2 }, fade]}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 2 }}>
            {row.map((c) => (
              <DayCell key={c.key} c={c} onPress={() => goDate(c.w, c.di)} />
            ))}
          </View>
        ))}
      </Animated.View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          marginTop: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: C.terra,
            }}
          />
          <T style={sans(12, 400, C.ink2)}>Meals planned</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: C.green,
            }}
          />
          <T style={sans(12, 400, C.ink2)}>Today</T>
        </View>
      </View>
    </Sheet>
  );
}

function MonthBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.9}
      easing={CSS_EASE}
      accessibilityLabel={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={22} color={C.ink} />
    </Press>
  );
}

function DayCell({ c, onPress }: { c: Cell; onPress: () => void }) {
  const bg = useAnimatedStyle(() => ({
    backgroundColor: tw(c.sel ? C.green : 'rgba(50,83,60,0)', 200, CSS_EASE),
  }));
  if (!c.vis) return <View style={{ flex: 1, height: 46 }} />;
  return (
    <Press
      onPress={onPress}
      scale={0.92}
      ms={180}
      easing={CSS_EASE}
      animatedStyle={bg}
      style={{
        flex: 1,
        minWidth: 0,
        height: 46,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: c.sel || c.today ? C.green : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <T style={sans(15, c.sel || c.today ? 700 : 500, c.sel ? C.bg : C.ink)}>
        {c.n}
      </T>
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: c.has
            ? c.sel
              ? C.greenSoft2
              : C.terra
            : 'transparent',
        }}
      />
    </Press>
  );
}
