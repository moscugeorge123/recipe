import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  useDeletePantryItem,
  usePatchPantryItem,
} from '@/features/pantry/hooks';
import { tint } from '@/tortie/color';
import {
  editPantry,
  smartMin,
  useGrocUi,
  useGroceryActions,
  useRecipeTitle,
  useTGroceries,
  useTPantry,
  type Pending,
  type TGroc,
  type TPantry,
} from '@/tortie/data/groceries';
import {
  usePantryExtras,
  type PantryLevel,
  type PantryUnit,
} from '@/tortie/data/pantry-extras';
import { currentMonday, usePlanWeek } from '@/tortie/data/plan';
import { useFrame } from '@/tortie/frame';
import { AHUE, AISLES, plz, SHELVES, SHUE } from '@/tortie/lib/fmt';
import { useMotion } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, F, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { GroceryArt, PantryArt } from '@/tortie/ui/art';
import { Grabber, Segmented } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { iconText } from '@/tortie/ui/icon-text';
import { Dots, Orb, Pop, ShimmerText } from '@/tortie/ui/keyframes';
import { useKeyboardLift } from '@/tortie/ui/keyboard';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { Stagger } from '@/tortie/ui/stagger';
import { TabScroll } from '@/tortie/ui/tab-scroll';
import { ctl, em, sans, serif, T } from '@/tortie/ui/text';

const LV = ['', 'Running low', 'Some left', 'Plenty'] as const;
const LVC = ['', C.terra, C.ink2, C.green] as const;
const G_CHIPS: [string, string][] = [
  ['🥛', 'Milk'],
  ['🥚', 'Eggs'],
  ['🍞', 'Bread'],
  ['🍌', 'Bananas'],
  ['☕', 'Coffee'],
];
const P_CHIPS: [string, string][] = [
  ['🫒', 'Olive oil'],
  ['🧂', 'Sea salt'],
  ['🍚', 'Rice'],
  ['🍝', 'Pasta'],
  ['🧅', 'Onions'],
  ['🧄', 'Garlic'],
];
const BASICS = [
  'Olive oil',
  'Sea salt',
  'Black pepper',
  'Rice',
  'Spaghetti',
  'Onions',
  'Garlic',
  'Eggs',
  'Butter',
];
const INPUT_WEB = { outlineStyle: 'none' } as object;

const stockOf = (p: TPantry) => {
  const a: string[] = [];
  if (p.packs) a.push(plz(p.packs, 'pack'));
  if (p.items) a.push(p.packs ? p.items + ' pcs' : plz(p.items, 'item'));
  return a.join(' · ') || 'None left';
};
const qtyOf = (p: { amt: number | null; unit: string }) =>
  p.amt != null && !isNaN(+p.amt)
    ? (+p.amt).toLocaleString('en', { maximumFractionDigits: 2 }) + ' ' + p.unit
    : '';

const useGrocOn = () => useNav((s) => s.tab === 'groceries' && s.mounted);

export function GroceriesScreen() {
  const on = useGrocOn();
  const sec = useNav((s) => s.grocSec);
  const isP = sec === 'pantry';
  const title = useRecipeTitle();
  const { list: grocAll } = useTGroceries(title);
  const { list: pantryAll } = useTPantry();
  const pending = useGrocUi((s) => s.pending);
  const fresh = useGrocUi((s) => s.fresh);
  const secFade = useGrocUi((s) => s.secFade);
  const setSec = useGrocUi((s) => s.setSec);
  const act = useGroceryActions();
  const { recipeIds } = usePlanWeek(currentMonday());
  const [addText, setAddText] = useState('');

  const held = new Set(pending.map((p) => p.hold).filter(Boolean));
  const groc = grocAll.filter((g) => !held.has(g.id));
  const pantry = pantryAll.filter((p) => !held.has(p.id));
  const dest = isP ? 'pantry' : 'groc';
  const pend = pending.filter((p) => p.dest === dest);
  const nLow = pantry.filter((p) => p.lv === 1).length;
  const gDone = groc.filter((g) => g.done).length;
  const gEmpty = !groc.length && !pending.some((p) => p.dest === 'groc');
  const pEmpty = !pantry.length && !pending.some((p) => p.dest === 'pantry');
  const lower = (s: string) => s.trim().toLowerCase();
  const inPending = (n: string) =>
    pending.some((p) => lower(p.raw) === lower(n));
  const inGroc = (n: string) =>
    grocAll.some((g) => lower(g.n) === lower(n)) || inPending(n);
  const inPan = (n: string) =>
    pantryAll.some((g) => lower(g.n) === lower(n)) || inPending(n);

  const sub = isP
    ? pantry.length
      ? `${pantry.length} things at home${nLow ? ' · ' + nLow + ' running low' : ''}`
      : 'Nothing stocked yet'
    : groc.length
      ? `${gDone} of ${groc.length} in the basket`
      : 'Your list is clear';

  const addItem = () => {
    const t = addText.trim();
    if (!t) return;
    setAddText('');
    void act.addRaw(t, dest);
  };
  const addBasics = () =>
    BASICS.filter((t) => !inPan(t)).forEach((t, i) =>
      setTimeout(() => void act.addRaw(t, 'pantry'), i * 320),
    );

  const fx = useAnimatedStyle(() => ({
    opacity: tw(secFade ? 0 : 1, 180, CSS_EASE),
    transform: [{ translateY: tw(secFade ? 8 : 0, 260, EASE) }],
  }));

  const aisles = AISLES.map((name, ai) => ({
    name,
    items: groc.filter((g) => g.a === ai),
  })).filter((a) => a.items.length);
  const shelves = SHELVES.map((name, si) => ({
    name,
    items: pantry.filter((p) => p.sh === si),
  })).filter((x) => x.items.length);

  return (
    <TabScroll
      header={(compact) => (
        <GrocHeader
          compact={compact}
          on={on}
          sub={sub}
          isP={isP}
          showClear={!isP && gDone > 0}
          onClear={() => void act.clearBasket()}
          n0={groc.filter((g) => !g.done).length}
          n1={pantry.length}
          low={nLow > 0}
          bar={!isP && groc.length > 0}
          pct={gDone / Math.max(1, groc.length)}
          onGroc={() => setSec('groc')}
          onPantry={() => setSec('pantry')}
        />
      )}
    >
      <Stagger
        i={1}
        on={on}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          height: 50,
          paddingLeft: 14,
          paddingRight: 6,
          backgroundColor: C.surface2,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 99,
        }}
      >
        <Glyph name="auto_awesome" size={20} color={C.terra} fill />
        <TextInput
          value={addText}
          onChangeText={setAddText}
          onSubmitEditing={addItem}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={
            isP ? 'What’s in your kitchen?' : 'Add anything — “2 lemons”'
          }
          placeholderTextColor={C.ink3}
          allowFontScaling={false}
          style={[
            sans(15, 400),
            { flex: 1, minWidth: 0, padding: 0 },
            INPUT_WEB,
          ]}
        />
        <Press
          onPress={addItem}
          scale={0.9}
          easing={CSS_EASE}
          accessibilityLabel="Add"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: C.green,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="add" size={22} color={C.bg} />
        </Press>
      </Stagger>

      <View style={{ gap: 8, marginTop: pend.length ? 12 : 0 }}>
        {pend.map((p) => (
          <PendingRow key={p.id} p={p} isP={isP} />
        ))}
      </View>

      <Animated.View style={fx}>
        {!isP ? (
          <>
            {gEmpty ? (
              <FadeIn i={1} on={on}>
                <EmptyCard
                  art={<GroceryArt />}
                  title="Nothing on the list"
                  body="Type it however it comes to mind — “2 lemons”, “oat milk” — and Tortie tidies it into the right aisle."
                  bodyW={270}
                  icon="calendar_month"
                  iconFill={false}
                  cta="Add from this week’s plan"
                  onCta={() => void act.fillFromPlan(recipeIds)}
                  or="Or start with"
                  chips={G_CHIPS.filter((c) => !inGroc(c[1]))}
                  onChip={(l) => void act.addRaw(l, 'groc')}
                />
              </FadeIn>
            ) : null}
            {aisles.map((a, i) => (
              <Stagger key={a.name} i={2 + i} on={on} style={{ marginTop: 22 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginHorizontal: 4,
                    marginBottom: 6,
                  }}
                >
                  <T
                    style={[
                      sans(12, 700, C.green),
                      {
                        letterSpacing: em(12, 0.06),
                        textTransform: 'uppercase',
                      },
                    ]}
                  >
                    {a.name}
                  </T>
                  <T style={sans(12, 600, C.ink2)}>
                    {a.items.filter((g) => g.done).length +
                      ' / ' +
                      a.items.length}
                  </T>
                </View>
                <View
                  style={{
                    backgroundColor: C.white,
                    borderWidth: 1,
                    borderColor: C.line,
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  {a.items.map((g, j) => (
                    <GrocRow
                      key={g.id}
                      g={g}
                      first={j === 0}
                      fresh={!!fresh[g.id]}
                      onToggle={act.toggle}
                    />
                  ))}
                </View>
              </Stagger>
            ))}
          </>
        ) : (
          <>
            {pEmpty ? (
              <EmptyCard
                art={<PantryArt />}
                title="A blank shelf"
                body="Tell Tortie what’s already in your kitchen. Recipes skip what you have, and anything running low gets a nudge."
                bodyW={280}
                icon="auto_awesome"
                iconFill
                cta="Stock the kitchen basics"
                onCta={addBasics}
                or="Or add one by one"
                chips={P_CHIPS.filter((c) => !inPan(c[1]))}
                onChip={(l) => void act.addRaw(l, 'pantry')}
              />
            ) : null}
            {pantryAll.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 16,
                  marginHorizontal: 4,
                }}
              >
                <Glyph name="touch_app" size={16} color={C.ink2} />
                <T style={sans(12, 400, C.ink2)}>
                  Tap an item to edit its count, packets and quantity
                </T>
              </View>
            ) : null}
            {shelves.map((sh) => {
              const low = sh.items.filter((p) => p.lv === 1).length;
              return (
                <View key={sh.name} style={{ marginTop: 20 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginHorizontal: 4,
                      marginBottom: 8,
                    }}
                  >
                    <T
                      style={[
                        sans(12, 700, C.green),
                        {
                          letterSpacing: em(12, 0.06),
                          textTransform: 'uppercase',
                        },
                      ]}
                    >
                      {sh.name}
                    </T>
                    <T style={sans(12, 600, low ? C.terra : C.ink2)}>
                      {low
                        ? low + ' running low'
                        : plz(sh.items.length, 'item')}
                    </T>
                  </View>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  >
                    {sh.items.map((p) => (
                      <PantryTile
                        key={p.id}
                        p={p}
                        fresh={!!fresh[p.id]}
                        onRestock={act.restock}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </Animated.View>
    </TabScroll>
  );
}

function GrocHeader({
  compact,
  on,
  sub,
  isP,
  showClear,
  onClear,
  n0,
  n1,
  low,
  bar,
  pct,
  onGroc,
  onPantry,
}: {
  compact: boolean;
  on: boolean;
  sub: string;
  isP: boolean;
  showClear: boolean;
  onClear: () => void;
  n0: number;
  n1: number;
  low: boolean;
  bar: boolean;
  pct: number;
  onGroc: () => void;
  onPantry: () => void;
}) {
  const [bw, setBw] = useState(0);
  const pad = useAnimatedStyle(() => ({
    paddingTop: tw(compact ? 10 : 8, 220, CSS_EASE),
    paddingBottom: tw(compact ? 10 : 16, 220, CSS_EASE),
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
  const barA = useAnimatedStyle(() => ({
    height: tw(bar ? 8 : 0, 300, CSS_EASE),
  }));
  const fill = useAnimatedStyle(() => ({ width: tw(bw * pct, 600, EASE) }));
  return (
    <Stagger i={0} on={on} style={{ paddingBottom: bar ? 12 : 0 }}>
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
          },
          pad,
        ]}
      >
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <Animated.Text
            allowFontScaling={false}
            style={[serif(36, 500), title]}
          >
            Groceries
          </Animated.Text>
          <Animated.View style={[{ overflow: 'hidden' }, subA]}>
            <T
              numberOfLines={1}
              style={[sans(14, 400, C.ink2), { lineHeight: 20 }]}
            >
              {sub}
            </T>
          </Animated.View>
        </View>
        {showClear ? (
          <Press
            onPress={onClear}
            scale={0.95}
            easing={CSS_EASE}
            style={{
              flexShrink: 0,
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: C.line,
              backgroundColor: C.white,
              justifyContent: 'center',
            }}
          >
            <T style={sans(13, 600)}>Clear basket</T>
          </Press>
        ) : null}
      </Animated.View>
      <Segmented
        index={isP ? 1 : 0}
        style={{ marginBottom: 12 }}
        items={[
          { label: 'Shopping list', badge: String(n0), onPress: onGroc },
          {
            label: 'Pantry',
            badge: String(n1),
            badgeOnBg: low ? C.terra : C.green,
            onPress: onPantry,
          },
        ]}
      />
      <Animated.View
        onLayout={(e) => setBw(e.nativeEvent.layout.width)}
        style={[
          { backgroundColor: C.surface3, borderRadius: 9, overflow: 'hidden' },
          barA,
        ]}
      >
        <Animated.View
          style={[
            { height: 8, backgroundColor: C.green, borderRadius: 9 },
            fill,
          ]}
        />
      </Animated.View>
    </Stagger>
  );
}

/** Opacity-only stagger (the empty list card only fades with block 1). */
function FadeIn({
  i,
  on,
  children,
}: {
  i: number;
  on: boolean;
  children: ReactNode;
}) {
  const { D, m } = useMotion();
  const delay = Math.round((70 + i * 55) * m);
  const a = useAnimatedStyle(
    () => ({
      opacity: on
        ? withDelay(delay, withTiming(1, { duration: D, easing: EASE }))
        : 0,
    }),
    [on, delay, D],
  );
  return <Animated.View style={a}>{children}</Animated.View>;
}

function EmptyCard({
  art,
  title,
  body,
  bodyW,
  icon,
  iconFill,
  cta,
  onCta,
  or,
  chips,
  onChip,
}: {
  art: ReactNode;
  title: string;
  body: string;
  bodyW: number;
  icon: string;
  iconFill: boolean;
  cta: string;
  onCta: () => void;
  or: string;
  chips: [string, string][];
  onChip: (label: string) => void;
}) {
  return (
    <View
      style={{
        marginTop: 20,
        paddingTop: 30,
        paddingHorizontal: 22,
        paddingBottom: 24,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 28,
        alignItems: 'center',
      }}
    >
      {art}
      <T
        style={[
          serif(27, 500),
          { letterSpacing: em(27, -0.015), marginTop: 18, textAlign: 'center' },
        ]}
      >
        {title}
      </T>
      <T
        style={[
          sans(14, 400, C.ink2),
          {
            lineHeight: 21,
            marginTop: 8,
            maxWidth: bodyW,
            textAlign: 'center',
          },
        ]}
      >
        {body}
      </T>
      <Press
        onPress={onCta}
        scale={0.96}
        easing={CSS_EASE}
        style={{
          marginTop: 22,
          height: 48,
          paddingHorizontal: 22,
          borderRadius: 99,
          backgroundColor: C.green,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Glyph name={icon} size={20} color={C.bg} fill={iconFill} />
        <T style={sans(14, 700, C.bg)}>{cta}</T>
      </Press>
      <T
        style={[
          sans(11, 700, C.ink3),
          {
            letterSpacing: em(11, 0.08),
            textTransform: 'uppercase',
            marginTop: 24,
          },
        ]}
      >
        {or}
      </T>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          marginTop: 10,
        }}
      >
        {chips.map(([e, l]) => (
          <Press
            key={l}
            onPress={() => onChip(l)}
            scale={0.94}
            easing={CSS_EASE}
            bg={C.bg}
            pressedBg={C.surface3}
            style={{
              height: 36,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: C.line,
              backgroundColor: C.bg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <T style={{ fontSize: 16, lineHeight: 20 }}>{e}</T>
            <T style={sans(13, 600)}>{l}</T>
          </Press>
        ))}
      </View>
    </View>
  );
}

function PendingRow({ p, isP }: { p: Pending; isP: boolean }) {
  const r = p.res;
  const [now, setNow] = useState(p.t0);
  useEffect(() => {
    if (r) return;
    const t = setInterval(() => setNow(Date.now()), 350);
    return () => clearInterval(t);
  }, [r]);
  const STG = [
    'Reading',
    'Recognising the ingredient',
    'Picking an icon',
    isP ? 'Finding its shelf' : 'Finding its aisle',
  ];
  const k = Math.min(
    STG.length - 1,
    Math.floor((now - p.t0) / (smartMin() / STG.length)),
  );
  const bd = useAnimatedStyle(() => ({
    borderColor: tw(r ? C.greenSoft : C.terraSoft, 400, CSS_EASE),
  }));
  const col = useAnimatedStyle(() => ({
    color: tw(r ? C.green : C.terra, 300, CSS_EASE),
  }));
  const labelStyle = sans(15, 600);
  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 12,
          paddingLeft: 12,
          paddingRight: 16,
          backgroundColor: C.white,
          borderWidth: 1,
          borderRadius: 18,
          boxShadow: '0 10px 24px -18px rgba(162,62,24,.5)',
        },
        bd,
      ]}
    >
      {r ? (
        <Pop ms={560} key="tile">
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tint(
                isP ? (SHUE[r.sh] ?? 250) : (AHUE[r.a] ?? 250),
              ),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontSize: 22, lineHeight: 28 }}>{r.e}</T>
          </View>
        </Pop>
      ) : (
        <Orb key="orb" size={40} radius={12} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {r ? (
          <T numberOfLines={1} style={labelStyle}>
            {r.n}
          </T>
        ) : (
          <ShimmerText style={labelStyle}>{p.raw}</ShimmerText>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 3,
          }}
        >
          <Animated.Text allowFontScaling={false} style={[iconText(14), col]}>
            {r ? 'check_circle' : 'auto_awesome'}
          </Animated.Text>
          <Animated.Text allowFontScaling={false} style={[sans(12, 600), col]}>
            {r
              ? isP
                ? 'On the shelf · ' + SHELVES[r.sh]
                : 'Sorted into ' + AISLES[r.a]
              : STG[k]}
          </Animated.Text>
          {r ? null : <Dots textStyle={sans(12, 600, C.terra)} />}
        </View>
      </View>
      <T style={sans(13, 600, C.ink2)}>{r && !isP ? r.q : ''}</T>
    </Animated.View>
  );
}

const STRIKE_LH = 19;

function GrocRow({
  g,
  first,
  fresh,
  onToggle,
}: {
  g: TGroc;
  first: boolean;
  fresh: boolean;
  onToggle: (g: TGroc) => void;
}) {
  const done = g.done;
  const row = useAnimatedStyle(() => ({
    backgroundColor: tw(fresh ? C.greenWash : C.white, 1200, CSS_EASE),
  }));
  const tile = useAnimatedStyle(() => ({
    opacity: tw(done ? 0.5 : 1, 300, CSS_EASE),
    transform: [{ scale: tw(fresh ? 1.12 : 1, 600, SPRING) }],
  }));
  const body = useAnimatedStyle(() => ({
    opacity: tw(done ? 0.5 : 1, 300, CSS_EASE),
  }));
  const txt = useAnimatedStyle(() => ({
    color: tw(done ? C.ink2 : C.ink, 300, CSS_EASE),
  }));
  const strike = useAnimatedStyle(() => ({
    backgroundColor: tw(done ? C.ink2 : C.ink, 300, CSS_EASE),
    transform: [{ scaleX: tw(done ? 1 : 0, 320, EASE) }],
  }));
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(done ? C.green : C.bg, 260, CSS_EASE),
    borderColor: tw(done ? C.green : C.lineStrong, 260, CSS_EASE),
  }));
  const chk = useAnimatedStyle(() => ({
    transform: [{ scale: tw(done ? 1 : 0, 380, SPRING) }],
  }));
  return (
    <Press
      onPress={() => onToggle(g)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      animatedStyle={row}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 16,
        minHeight: 60,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: C.surface3,
      }}
    >
      <Animated.View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tint(AHUE[g.a] ?? 250),
            alignItems: 'center',
            justifyContent: 'center',
          },
          tile,
        ]}
      >
        <T style={{ fontSize: 22, lineHeight: 28 }}>{g.e || '🛒'}</T>
      </Animated.View>
      <Animated.View style={[{ flex: 1, minWidth: 0 }, body]}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Animated.Text
            allowFontScaling={false}
            style={[sans(15, 600), { lineHeight: STRIKE_LH }, txt]}
          >
            {g.n}
          </Animated.Text>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                top: (STRIKE_LH - 1.5) * 0.55,
                height: 1.5,
                transformOrigin: 'left center',
              },
              strike,
            ]}
          />
        </View>
        <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
          {[g.q, g.src].filter(Boolean).join(' · ')}
        </T>
      </Animated.View>
      <Animated.View
        style={[
          {
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
          },
          box,
        ]}
      >
        <Animated.View style={chk}>
          <Glyph name="check" size={18} color={C.bg} />
        </Animated.View>
      </Animated.View>
    </Press>
  );
}

function PantryTile({
  p,
  fresh,
  onRestock,
}: {
  p: TPantry;
  fresh: boolean;
  onRestock: (p: TPantry) => void;
}) {
  const { width } = useWindowDimensions();
  const w = (width - 40 - 16) / 3;
  const low = p.lv === 1;
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(
      fresh ? C.greenWash : low ? C.terraWash : C.white,
      400,
      CSS_EASE,
    ),
    borderColor: tw(
      fresh ? C.greenSoft : low ? C.terraSoft : C.line,
      400,
      CSS_EASE,
    ),
    transform: [{ scale: tw(fresh ? 1.04 : 1, 600, SPRING) }],
  }));
  const rs = useAnimatedStyle(() => ({
    backgroundColor: tw(p.listed ? C.green : C.terra, 300, CSS_EASE),
  }));
  return (
    <Press
      onPress={() => useNav.getState().set({ pedOn: true, pedId: p.id })}
      scale={0.96}
      easing={SPRING}
      ms={600}
      style={{ width: w }}
    >
      <Animated.View
        style={[
          {
            minHeight: 124,
            paddingTop: 12,
            paddingHorizontal: 10,
            paddingBottom: 10,
            borderRadius: 18,
            borderWidth: 1,
            gap: 6,
          },
          box,
        ]}
      >
        <T style={{ fontSize: 28, lineHeight: 30.8 }}>{p.e}</T>
        <T style={[sans(13, 600), { flex: 1, lineHeight: 16.25 }]}>{p.n}</T>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {[1, 2, 3].map((b) => (
            <LevelBar key={b} bg={b <= p.lv ? LVC[p.lv] : C.line} />
          ))}
        </View>
        <View style={{ gap: 1 }}>
          <T
            style={[
              sans(12, 700),
              { lineHeight: 15.6, fontVariant: ['tabular-nums'] },
            ]}
          >
            {stockOf(p)}
          </T>
          <T
            style={[
              sans(11, 600, LVC[p.lv]),
              { fontVariant: ['tabular-nums'] },
            ]}
          >
            {qtyOf(p) || LV[p.lv]}
          </T>
        </View>
        {low ? (
          <Press
            onPress={() => onRestock(p)}
            scale={0.88}
            easing={CSS_EASE}
            accessibilityLabel={
              p.listed ? 'Show on shopping list' : 'Add to shopping list'
            }
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            <Animated.View
              style={[
                {
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                rs,
              ]}
            >
              <Glyph
                name={p.listed ? 'check' : 'add_shopping_cart'}
                size={17}
                color={C.bg}
              />
            </Animated.View>
          </Press>
        ) : null}
      </Animated.View>
    </Press>
  );
}

function LevelBar({ bg }: { bg: string }) {
  const a = useAnimatedStyle(() => ({
    backgroundColor: tw(bg, 300, CSS_EASE),
  }));
  return <Animated.View style={[{ flex: 1, height: 4, borderRadius: 2 }, a]} />;
}

/* ───────────── Edit pantry item ───────────── */

type Draft = {
  id: string;
  n: string;
  e: string;
  sh: number;
  items: number;
  packs: number;
  amt: string;
  unit: PantryUnit;
  lv: PantryLevel;
  listed: boolean;
};

export function EditPantrySheet() {
  const f = useFrame();
  const open = useNav((s) => s.pedOn);
  const pedId = useNav((s) => s.pedId);
  const { list } = useTPantry();
  const client = useQueryClient();
  const patch = usePatchPantryItem();
  const del = useDeletePantryItem();
  const lift = useKeyboardLift();
  const [d, setD] = useState<Draft | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    const p = open ? list.find((x) => x.id === pedId) : undefined;
    if (p) {
      setD({
        id: p.id,
        n: p.n,
        e: p.e,
        sh: p.sh,
        items: p.items,
        packs: p.packs,
        amt: p.amt != null ? String(p.amt) : '',
        unit: p.unit,
        lv: p.lv,
        listed: p.listed,
      });
    }
  }

  const x = d ?? {
    id: '',
    n: '',
    e: '',
    sh: 0,
    items: 0,
    packs: 0,
    amt: '',
    unit: 'g' as PantryUnit,
    lv: 3 as PantryLevel,
    listed: false,
  };
  const up = (o: Partial<Draft>) => setD((s) => (s ? { ...s, ...o } : s));
  const close = () => useNav.getState().set({ pedOn: false });

  const save = () => {
    if (!d) return close();
    const cur = list.find((p) => p.id === d.id);
    const a = parseFloat(String(d.amt).replace(',', '.'));
    const name = d.n.trim() || cur?.n || d.n;
    close();
    usePantryExtras.getState().patch(d.id, {
      items: d.items,
      packs: d.packs,
      amt: isNaN(a) ? null : a,
      unit: d.unit,
      lv: d.lv,
      listed: d.lv === 1 ? (cur?.listed ?? d.listed) : false,
    });
    if (cur && name !== cur.n) {
      editPantry(client, (items) =>
        items.map((v) => (v.id === d.id ? { ...v, name } : v)),
      );
      patch.mutate(
        { id: d.id, body: { name } },
        {
          onError: () => {
            editPantry(client, (items) =>
              items.map((v) => (v.id === d.id ? cur.view : v)),
            );
            toast('Couldn’t rename ' + cur.n + '. Try again.');
          },
        },
      );
    }
  };

  const remove = () => {
    if (!d) return close();
    const gone = list.find((p) => p.id === d.id);
    close();
    editPantry(client, (items) => items.filter((v) => v.id !== d.id));
    toast(d.e + ' ' + d.n + ' removed from pantry');
    del.mutate(d.id, {
      onSuccess: () => usePantryExtras.getState().remove(d.id),
      onError: () => {
        if (gone) editPantry(client, (items) => [...items, gone.view]);
        toast('Couldn’t remove ' + d.n + '. Try again.');
      },
    });
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      z={40}
      style={[{ paddingBottom: f.sheetBottom }, lift]}
    >
      <Grabber />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={{ fontSize: 28, lineHeight: 32 }}>{x.e}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            value={x.n}
            onChangeText={(n) => up({ n })}
            maxLength={40}
            accessibilityLabel="Name"
            allowFontScaling={false}
            style={[
              {
                padding: 0,
                fontFamily: F.serif500,
                fontSize: 24,
                letterSpacing: em(24, -0.01),
                color: C.ink,
              },
              INPUT_WEB,
            ]}
          />
          <T
            style={[
              sans(12, 700, C.green),
              {
                letterSpacing: em(12, 0.06),
                textTransform: 'uppercase',
                marginTop: 2,
              },
            ]}
          >
            {SHELVES[x.sh] ?? ''}
          </T>
        </View>
        <Press
          onPress={close}
          accessibilityLabel="Close"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: C.surface3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={20} color={C.ink2} />
        </Press>
      </View>
      <View
        style={{
          marginTop: 18,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 22,
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 16,
          paddingRight: 14,
        }}
      >
        <StepRow
          title="Items"
          sub="Pieces, tins, bottles or slices"
          value={x.items}
          onDn={() => up({ items: Math.max(0, x.items - 1) })}
          onUp={() => up({ items: x.items + 1 })}
        />
        <View style={{ height: 1, backgroundColor: C.surface3 }} />
        <StepRow
          title="Packets"
          sub={x.packs ? 'Sealed or opened packs' : 'Loose — not in a packet'}
          value={x.packs}
          onDn={() => up({ packs: Math.max(0, x.packs - 1) })}
          onUp={() => up({ packs: x.packs + 1 })}
        />
        <View style={{ height: 1, backgroundColor: C.surface3 }} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={sans(15, 600)}>Quantity</T>
            <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
              Total amount on the shelf
            </T>
          </View>
          <TextInput
            value={x.amt}
            onChangeText={(t) => up({ amt: t.replace(/[^\d.,]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={C.ink3}
            accessibilityLabel="Quantity"
            allowFontScaling={false}
            style={[
              sans(16, 700),
              {
                width: 92,
                height: 44,
                borderRadius: 99,
                backgroundColor: C.surface2,
                paddingVertical: 0,
                paddingHorizontal: 16,
                textAlign: 'right',
                fontVariant: ['tabular-nums'],
              },
              INPUT_WEB,
            ]}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        {(['g', 'kg', 'ml', 'l'] as PantryUnit[]).map((u) => (
          <GridPill
            key={u}
            label={u}
            on={x.unit === u}
            onPress={() => up({ unit: u })}
          />
        ))}
      </View>
      <T
        style={[
          sans(12, 700, C.ink2),
          {
            letterSpacing: em(12, 0.08),
            textTransform: 'uppercase',
            marginTop: 20,
          },
        ]}
      >
        How much is left
      </T>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        {([1, 2, 3] as PantryLevel[]).map((k) => (
          <GridPill
            key={k}
            label={LV[k]}
            on={x.lv === k}
            onPress={() => up({ lv: k })}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        <Press
          onPress={remove}
          scale={0.92}
          easing={CSS_EASE}
          accessibilityLabel="Remove from pantry"
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: C.terraSoft,
            backgroundColor: C.terraWash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="delete" size={22} color={C.terra} />
        </Press>
        <Press
          onPress={save}
          scale={0.97}
          easing={CSS_EASE}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 99,
            backgroundColor: C.green,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(15, 700, C.bg)}>Save</T>
        </Press>
      </View>
    </Sheet>
  );
}

function StepRow({
  title,
  sub,
  value,
  onDn,
  onUp,
}: {
  title: string;
  sub: string;
  value: number;
  onDn: () => void;
  onUp: () => void;
}) {
  const dn = useAnimatedStyle(() => ({
    opacity: tw(value ? 1 : 0.35, 200, CSS_EASE),
  }));
  const btn = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={sans(15, 600)}>{title}</T>
        <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>{sub}</T>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          backgroundColor: C.surface2,
          borderRadius: 99,
          padding: 4,
        }}
      >
        <Press
          onPress={onDn}
          scale={0.88}
          easing={CSS_EASE}
          accessibilityLabel="Decrease"
          style={btn}
          animatedStyle={dn}
        >
          <Glyph name="remove" size={20} color={C.ink} />
        </Press>
        <T
          style={[
            sans(16, 700),
            {
              minWidth: 30,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            },
          ]}
        >
          {String(value)}
        </T>
        <Press
          onPress={onUp}
          scale={0.88}
          easing={CSS_EASE}
          accessibilityLabel="Increase"
          style={btn}
        >
          <Glyph name="add" size={20} color={C.ink} />
        </Press>
      </View>
    </View>
  );
}

/** Grid pill (unit / level): 40 tall, bg · colour 200ms, press .95. */
function GridPill({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.green : C.white, 200, CSS_EASE),
  }));
  const txt = useAnimatedStyle(() => ({
    color: tw(on ? C.bg : C.ink, 200, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      scale={0.95}
      easing={CSS_EASE}
      accessibilityState={{ selected: on }}
      animatedStyle={box}
      style={{
        flex: 1,
        minWidth: 0,
        height: 40,
        paddingHorizontal: 8,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: on ? C.green : C.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[ctl(13, 600), txt]}
      >
        {label}
      </Animated.Text>
    </Press>
  );
}
