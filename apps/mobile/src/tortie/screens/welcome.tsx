import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { advertisedSourcesText } from '@/features/share/sources';
import { useTRecipes } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { useMotion } from '@/tortie/motion';
import { afterMotion, useNav } from '@/tortie/nav-store';
import { usePrefsHydrated, useTortiePrefs } from '@/tortie/prefs-store';
import { C, CSS_EASE, SH, SPRING } from '@/tortie/theme';
import { tw, useOpenProgress } from '@/tortie/ui/anim';
import { BrandLogo, type Brand } from '@/tortie/ui/brand';
import { KitchenMark } from '@/tortie/ui/first-recipe';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { em, kicker, sans, serif, T } from '@/tortie/ui/text';

const LOGO = require('@/assets/images/icon.png');

type PageDef = {
  kicker: string;
  title: string;
  body: string;
  Art: (p: { on: boolean }) => ReactNode;
};

const PAGES: PageDef[] = [
  {
    kicker: 'Welcome to Tortie',
    title: 'Every recipe you love, in one kitchen',
    body: `Save recipes from ${advertisedSourcesText()}. Snap a cookbook page, or write down the one in your head.`,
    Art: ImportArt,
  },
  {
    kicker: 'Cook mode',
    title: 'Cook hands-free, one step at a time',
    body: 'Big, clear steps with timers that keep running while you chop. The screen stays awake, and servings and units change in a tap.',
    Art: CookArt,
  },
  {
    kicker: 'Plan & shop',
    title: 'Plan the week, shop in one trip',
    body: 'Drop recipes onto your week. Tortie turns them into a grocery list sorted by aisle and skips what’s already in your pantry.',
    Art: PlanArt,
  },
  {
    kicker: 'Ready when you are',
    title: 'Add your first recipe',
    body: 'Paste a link, share one from another app, or scan a page. Tortie reads it and sets it up for cooking.',
    Art: StartArt,
  },
];

const LAST = PAGES.length - 1;

/** Marks the tour seen and closes it; `add` then opens the Add sheet. */
export function finishWelcome(add = false) {
  useTortiePrefs.getState().set({ welcomed: true });
  useNav.getState().closeWelcome();
  if (add) afterMotion(320, () => useNav.getState().openAdd());
}

/**
 * Opens the tour once per device for a signed-in user whose library is still
 * empty. Someone who already has recipes (an existing account on a new phone)
 * is marked as welcomed without seeing it.
 */
export function useWelcomeGate() {
  const hydrated = usePrefsHydrated();
  const welcomed = useTortiePrefs((s) => s.welcomed);
  const { list, isLoading, isError } = useTRecipes();
  const has = list.length > 0;
  useEffect(() => {
    if (!hydrated || welcomed || isLoading || isError) return;
    if (has) useTortiePrefs.getState().set({ welcomed: true });
    else if (!useNav.getState().welcome) useNav.getState().openWelcome();
  }, [hydrated, welcomed, isLoading, isError, has]);
}

/** Full-screen first-run tour (layer 55: over cook mode, under sign-in). */
export function Welcome() {
  const f = useFrame();
  const { D } = useMotion();
  const { width } = useWindowDimensions();
  const open = useNav((s) => s.welcome);
  const nonce = useNav((s) => s.welcomeNonce);
  const { list } = useTRecipes();
  const hasRecipes = list.length > 0;
  const [page, setPage] = useState(0);
  // Furthest page reached: art animates in once, and stays when swiping back.
  const [reached, setReached] = useState(0);
  const scroller = useRef<ScrollView>(null);

  // Every open starts on the first page.
  const [openedAt, setOpenedAt] = useState(nonce);
  if (openedAt !== nonce) {
    setOpenedAt(nonce);
    setPage(0);
    setReached(0);
  }
  useEffect(() => {
    scroller.current?.scrollTo({ x: 0, animated: false });
  }, [nonce]);

  // A rotation changes the page width; keep the current page in view.
  useEffect(() => {
    scroller.current?.scrollTo({ x: page * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const show = (i: number) => {
    setPage(i);
    setReached((r) => Math.max(r, i));
  };
  const goTo = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    show(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.max(
      0,
      Math.min(LAST, Math.round(e.nativeEvent.contentOffset.x / width)),
    );
    if (i !== page) show(i);
  };

  const p = useOpenProgress(open, Math.round(D * 1.1));
  const layer = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 28 }],
  }));
  const last = page === LAST;
  const skipSt = useAnimatedStyle(() => ({
    opacity: tw(last ? 0 : 1, 220, CSS_EASE),
  }));
  const laterSt = useAnimatedStyle(() => ({
    opacity: tw(last ? 1 : 0, 220, CSS_EASE),
  }));
  const ctaSt = useAnimatedStyle(() => ({
    backgroundColor: tw(last ? C.terra : C.green, 300, CSS_EASE),
  }));

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      accessibilityViewIsModal={open}
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 55, backgroundColor: C.bg },
        layer,
      ]}
    >
      <View
        style={{
          marginTop: f.pushTop,
          height: 44,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Image
          source={LOGO}
          style={{ width: 32, height: 32, borderRadius: 10 }}
          contentFit="cover"
          accessibilityLabel="Tortie"
        />
        <T style={serif(20, 600)}>Tortie</T>
        <Animated.View
          style={[{ marginLeft: 'auto' }, skipSt]}
          pointerEvents={last ? 'none' : 'auto'}
        >
          <Press
            onPress={() => finishWelcome()}
            scale={0.94}
            accessibilityLabel="Skip the tour"
            style={{
              height: 36,
              paddingHorizontal: 16,
              borderRadius: 99,
              backgroundColor: C.surface3,
              justifyContent: 'center',
            }}
          >
            <T style={sans(13, 700, C.ink2)}>Skip</T>
          </Press>
        </Animated.View>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={onScroll}
        style={{ flex: 1 }}
      >
        {PAGES.map((pg, i) => (
          <Page
            key={pg.title}
            def={
              i === LAST && hasRecipes
                ? {
                    ...pg,
                    title: 'Add another recipe',
                    body: 'Paste a link, share one from another app, or scan a page. It lands in your Cookbook, ready to cook.',
                  }
                : pg
            }
            width={width}
            on={open && reached >= i}
            current={page === i}
          />
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: Math.max(24, f.bottom + 12),
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 20,
          }}
          accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}
        >
          {PAGES.map((pg, i) => (
            <Press
              key={pg.title}
              onPress={() => goTo(i)}
              hitSlop={8}
              accessibilityLabel={`Go to page ${i + 1}`}
            >
              <Dot on={page === i} />
            </Press>
          ))}
        </View>
        <Press
          onPress={() => (last ? finishWelcome(true) : goTo(page + 1))}
          scale={0.97}
          ms={220}
          animatedStyle={ctaSt}
          style={{
            height: 54,
            borderRadius: 99,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: last ? SH.terraCta : SH.greenCta,
          }}
        >
          {last ? <Glyph name="add" size={21} color={C.white} /> : null}
          <T style={sans(15, 700, C.white)}>
            {last
              ? hasRecipes
                ? 'Add a recipe'
                : 'Add my first recipe'
              : 'Next'}
          </T>
          {last ? null : (
            <Glyph name="arrow_forward" size={20} color={C.white} />
          )}
        </Press>
        <Animated.View style={laterSt} pointerEvents={last ? 'auto' : 'none'}>
          <Press
            onPress={() => finishWelcome()}
            style={{
              height: 44,
              marginTop: 6,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(14, 600, C.green)}>
              {hasRecipes ? 'Back to my kitchen' : 'I’ll look around first'}
            </T>
          </Press>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function Page({
  def,
  width,
  on,
  current,
}: {
  def: PageDef;
  width: number;
  on: boolean;
  current: boolean;
}) {
  const { m } = useMotion();
  const txt = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0, Math.round(360 * m), CSS_EASE, Math.round(80 * m)),
    transform: [{ translateY: tw(on ? 0 : 12, Math.round(520 * m)) }],
  }));
  const { Art } = def;
  return (
    <View
      style={{ width, paddingHorizontal: 28 }}
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Art on={on} />
      </View>
      <Animated.View style={[{ minHeight: 178 }, txt]}>
        <T style={kicker(C.terra)}>{def.kicker}</T>
        <T
          style={[
            serif(32, 500),
            { letterSpacing: em(32, -0.02), lineHeight: 35, marginTop: 8 },
          ]}
        >
          {def.title}
        </T>
        <T style={[sans(15, 400, C.ink2), { lineHeight: 22.5, marginTop: 10 }]}>
          {def.body}
        </T>
      </Animated.View>
    </View>
  );
}

function Dot({ on }: { on: boolean }) {
  const a = useAnimatedStyle(() => ({
    width: tw(on ? 22 : 7, 300),
    backgroundColor: tw(on ? C.green : C.lineStrong, 300, CSS_EASE),
  }));
  return <Animated.View style={[{ height: 7, borderRadius: 4 }, a]} />;
}

/** Pops a piece of page art in: fade + slight overshoot, staggered by `i`. */
function Pop({
  on,
  i,
  style,
  children,
}: {
  on: boolean;
  i: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { m } = useMotion();
  const delay = on ? Math.round((140 + i * 70) * m) : 0;
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0, Math.round(300 * m), CSS_EASE, delay),
    transform: [
      { scale: tw(on ? 1 : 0.82, Math.round(520 * m), SPRING, delay) },
    ],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

const BADGE = 54;

function Badge({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: BADGE,
        height: BADGE,
        borderRadius: BADGE / 2,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: SH.cardSubtle,
      }}
    >
      {children}
    </View>
  );
}

const ORBIT: { x: number; y: number; brand?: Brand; icon?: string }[] = [
  { x: 18, y: 6, brand: 'instagram' },
  { x: 208, y: 0, brand: 'youtube' },
  { x: 0, y: 112, icon: 'edit' },
  { x: 226, y: 104, icon: 'link' },
  { x: 54, y: 196, icon: 'photo_camera' },
  { x: 172, y: 196, icon: 'language' },
];

function ImportArt({ on }: { on: boolean }) {
  return (
    <View style={{ width: 280, height: 250 }}>
      <Pop
        on={on}
        i={0}
        style={{ position: 'absolute', left: 88, top: 62, zIndex: 1 }}
      >
        <View
          style={{
            width: 104,
            height: 120,
            borderRadius: 28,
            backgroundColor: C.green,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: SH.greenCta,
          }}
        >
          <Glyph name="skillet" size={44} color={C.bg} fill />
        </View>
      </Pop>
      {ORBIT.map((o, i) => (
        <Pop
          key={i}
          on={on}
          i={i + 1}
          style={{ position: 'absolute', left: o.x, top: o.y }}
        >
          <Badge>
            {o.brand ? (
              <BrandLogo brand={o.brand} size={24} />
            ) : (
              <Glyph name={o.icon!} size={24} color={C.green} />
            )}
          </Badge>
        </Pop>
      ))}
    </View>
  );
}

function CookArt({ on }: { on: boolean }) {
  return (
    <View style={{ width: 290, height: 250, justifyContent: 'center' }}>
      <Pop on={on} i={0}>
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 22,
            padding: 18,
            boxShadow: SH.card,
          }}
        >
          <T
            style={[
              sans(11, 700, C.ink3),
              { letterSpacing: em(11, 0.05), textTransform: 'uppercase' },
            ]}
          >
            Step 2 of 5
          </T>
          <T style={[serif(21, 600), { lineHeight: 24, marginTop: 4 }]}>
            Simmer the tomato sauce
          </T>
          <T style={[sans(13, 400, C.ink2), { marginTop: 3 }]}>
            Low heat · stir now and then
          </T>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 14 }}>
            {[1, 0.55, 0, 0, 0].map((fr, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: C.surface3,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${fr * 100}%`,
                    height: '100%',
                    backgroundColor: C.terra,
                  }}
                />
              </View>
            ))}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 46,
                borderRadius: 99,
                backgroundColor: C.surface2,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
              }}
            >
              <Glyph name="timer" size={20} color={C.terra} />
              <T style={[sans(16, 700), { fontVariant: ['tabular-nums'] }]}>
                07:42
              </T>
              <T style={sans(12, 600, C.ink2)}>left</T>
            </View>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: C.terra,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: SH.terraCta,
              }}
            >
              <Glyph name="arrow_forward" size={22} color={C.white} />
            </View>
          </View>
        </View>
      </Pop>
      <Pop on={on} i={2} style={{ position: 'absolute', top: 2, right: -6 }}>
        <Chip icon="light_mode" label="Screen stays on" />
      </Pop>
      <Pop on={on} i={3} style={{ position: 'absolute', bottom: 0, left: -4 }}>
        <Chip icon="group" label="Serves 4 · metric" tone="terra" />
      </Pop>
    </View>
  );
}

function Chip({
  icon,
  label,
  tone = 'green',
}: {
  icon: string;
  label: string;
  tone?: 'green' | 'terra';
}) {
  const g = tone === 'green';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 99,
        backgroundColor: g ? C.greenWash : C.terraWash,
        borderWidth: 1,
        borderColor: g ? C.greenSoft : C.terraSoft,
        boxShadow: SH.cardSubtle,
      }}
    >
      <Glyph name={icon} size={16} color={g ? C.green : C.terra} />
      <T style={sans(12, 700, g ? C.green : C.terraInk)}>{label}</T>
    </View>
  );
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEALS = [
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
  [0, 0, 1],
  [0, 1, 0],
  [0, 0, 0],
  [1, 0, 1],
];
const ITEMS: [string, 'done' | 'todo' | 'pantry'][] = [
  ['Cherry tomatoes', 'done'],
  ['Fresh basil', 'todo'],
  ['Parmesan', 'pantry'],
];

function PlanArt({ on }: { on: boolean }) {
  return (
    <View style={{ width: 290, height: 260 }}>
      <Pop
        on={on}
        i={0}
        style={{ position: 'absolute', left: 0, top: 4, right: 30 }}
      >
        <View
          style={{
            backgroundColor: C.surface2,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 18,
            padding: 12,
            transform: [{ rotate: '-2deg' }],
          }}
        >
          <T style={[serif(16, 600), { marginBottom: 8, marginLeft: 2 }]}>
            This week
          </T>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {WEEK.map((l, i) => {
              const sel = i === 2;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 5,
                    paddingVertical: 7,
                    borderRadius: 12,
                    backgroundColor: sel ? C.green : 'transparent',
                  }}
                >
                  <T style={sans(10, 600, sel ? C.bg : C.ink3)}>{l}</T>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {MEALS[i]!.map((v, k) => (
                      <View
                        key={k}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: v
                            ? sel
                              ? C.greenSoft2
                              : C.terra
                            : sel
                              ? 'rgba(248,250,245,.3)'
                              : C.lineStrong,
                        }}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Pop>
      <Pop
        on={on}
        i={2}
        style={{ position: 'absolute', left: 34, right: 0, top: 104 }}
      >
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 18,
            paddingVertical: 6,
            paddingHorizontal: 14,
            boxShadow: SH.card,
            transform: [{ rotate: '1.5deg' }],
          }}
        >
          {ITEMS.map(([name, st], i) => (
            <View
              key={name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 9,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: C.surface3,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: st === 'done' ? 0 : 1.5,
                  borderColor: C.lineStrong,
                  backgroundColor: st === 'done' ? C.green : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {st === 'done' ? (
                  <Glyph name="check" size={15} color={C.white} />
                ) : null}
              </View>
              <T
                style={[
                  sans(14, 600, st === 'done' ? C.ink3 : C.ink),
                  st === 'done' ? { textDecorationLine: 'line-through' } : null,
                  { flex: 1 },
                ]}
              >
                {name}
              </T>
              {st === 'pantry' ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 99,
                    backgroundColor: C.greenWash,
                  }}
                >
                  <T style={sans(11, 700, C.green)}>In pantry</T>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </Pop>
    </View>
  );
}

function StartArt({ on }: { on: boolean }) {
  return (
    <Pop on={on} i={0}>
      <KitchenMark scale={1.35} />
    </Pop>
  );
}
