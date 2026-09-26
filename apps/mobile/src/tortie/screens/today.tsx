import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { firstName, useTortieAuth } from '@/tortie/auth-store';
import { hueOf, phCaption } from '@/tortie/color';
import { timerKey, useCook } from '@/tortie/cook-store';
import {
  currentMonday,
  MEAL_KEYS,
  todayIndex,
  usePlan,
  usePlanWeek,
  useRecipeSlot,
  type MealKey,
  type TDay,
} from '@/tortie/data/plan';
import { useTRecipe, useTRecipes, type TRecipe } from '@/tortie/data/recipes';
import {
  clock,
  DAYLETTERS,
  DAYNAMES,
  fmtT,
  greeting,
  todayLine,
} from '@/tortie/lib/fmt';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { PulseDot } from '@/tortie/ui/keyframes';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { Stagger } from '@/tortie/ui/stagger';
import { TabScroll } from '@/tortie/ui/tab-scroll';
import { em, kicker, mono, sans, serif, T } from '@/tortie/ui/text';

const LOGO = require('@/assets/tortie/tortie-logo.png');
const RING = 81.68;
const MEAL_LABEL: Record<MealKey, string> = {
  b: 'Breakfast',
  l: 'Lunch',
  d: 'Dinner',
};

const ACircle = Animated.createAnimatedComponent(Circle);

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const useTodayOn = () => useNav((s) => s.tab === 'today' && s.mounted);

function startCook(id: string) {
  useCook.getState().begin(id);
  useNav.getState().openCook(id);
}

export function TodayScreen() {
  const on = useTodayOn();
  return (
    <TabScroll header={(compact) => <TodayHeader compact={compact} on={on} />}>
      <CookingNow on={on} />
      <Tonight on={on} />
      <ThisWeek on={on} />
      <CookAgain on={on} />
    </TabScroll>
  );
}

function TodayHeader({ compact, on }: { compact: boolean; on: boolean }) {
  const authed = useTortieAuth((s) => s.authed);
  const user = useTortieAuth((s) => s.user);
  const openProfile = useNav((s) => s.openProfile);
  const now = useNow(60_000);
  const d = new Date(now);
  const greet = authed ? `${greeting(d)}, ${firstName(user)}` : greeting(d);
  const initials = (user?.name || '?')
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const row = useAnimatedStyle(() => ({
    gap: tw(compact ? 8 : 12, 220, CSS_EASE),
    paddingTop: tw(compact ? 10 : 8, 220, CSS_EASE),
    paddingBottom: tw(compact ? 10 : 22, 220, CSS_EASE),
  }));
  const logo = useAnimatedStyle(() => ({
    width: tw(compact ? 30 : 40, 220, CSS_EASE),
    height: tw(compact ? 30 : 40, 220, CSS_EASE),
  }));
  const date = useAnimatedStyle(() => ({
    fontSize: tw(compact ? 10 : 12, 220, CSS_EASE),
    letterSpacing: tw(compact ? 0.4 : 0.48, 220, CSS_EASE),
  }));
  const greetA = useAnimatedStyle(() => ({
    fontSize: tw(compact ? 17 : 26, 220, CSS_EASE),
    lineHeight: tw(compact ? 19.55 : 29.9, 220, CSS_EASE),
  }));

  return (
    <Stagger i={0} on={on}>
      <Animated.View
        style={[{ flexDirection: 'row', alignItems: 'center' }, row]}
      >
        <Animated.View style={[{ borderRadius: 12, overflow: 'hidden' }, logo]}>
          <Image
            source={LOGO}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityLabel="Tortie"
          />
        </Animated.View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Animated.Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              sans(12, 600, C.ink3),
              { textTransform: 'uppercase' },
              date,
            ]}
          >
            {todayLine(d)}
          </Animated.Text>
          <Animated.Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[serif(26, 500), { letterSpacing: em(26, -0.01) }, greetA]}
          >
            {greet}
          </Animated.Text>
        </View>
        <Press
          onPress={openProfile}
          scale={0.88}
          ms={220}
          easing={SPRING}
          accessibilityLabel="Profile"
          style={{ borderRadius: 99 }}
        >
          {authed ? (
            <Animated.View
              style={[
                {
                  borderRadius: 99,
                  backgroundColor: C.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: SH.avatarRing,
                },
                logo,
              ]}
            >
              <T
                style={[
                  sans(initials.length > 1 ? 13 : 16, 700, C.bg),
                  { textAlign: 'center', width: '100%' },
                ]}
              >
                {initials}
              </T>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                {
                  borderRadius: 99,
                  backgroundColor: C.surface3,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                logo,
              ]}
            >
              <Glyph name="person" size={22} color={C.green} fill />
            </Animated.View>
          )}
        </Press>
      </Animated.View>
    </Stagger>
  );
}

function CookingNow({ on }: { on: boolean }) {
  const active = useCook((s) => s.active);
  const activeOn = useCook((s) => s.activeOn);
  const timers = useCook((s) => s.timers);
  const { r } = useTRecipe(active?.id);
  const now = useNow(30_000);
  const show = activeOn && !!active && !!r && r.steps.length > 0;

  const wrap = useAnimatedStyle(() => ({
    maxHeight: tw(show ? 384 : 0, 420),
    paddingBottom: tw(show ? 24 : 0, 420),
    marginBottom: tw(show ? 4 : 0, 420),
    opacity: tw(show ? 1 : 0, 260, CSS_EASE),
  }));

  let body = null;
  if (active && r && r.steps.length) {
    const an = r.steps.length;
    const ast = Math.min(active.step, an - 1);
    const st = r.steps[ast]!;
    const key = timerKey(active.id, ast);
    const AT = timers[key] ?? { rem: st.m * 60, total: st.m * 60, run: false };
    const frac = st.m > 0 ? 1 - AT.rem / Math.max(1, AT.total) : 0.35;
    const fracs = r.steps.map((_, i) =>
      i < ast ? 1 : i === ast ? Math.max(6, Math.round(frac * 100)) / 100 : 0,
    );
    const ringCol = AT.run ? C.terra : C.ink3;
    const next =
      ast < an - 1
        ? 'Next: ' + r.steps[ast + 1]!.t
        : 'Last step — nearly there';
    const resume = () => startCook(active.id);
    body = (
      <>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <PulseDot />
          <T style={kicker(C.terra)}>Cooking now</T>
          <T style={[sans(12, 600, C.ink3), { marginLeft: 'auto' }]}>
            {'Started ' +
              fmtT(Math.max(1, Math.round((now - active.at) / 60000))) +
              ' ago'}
          </T>
        </View>
        <Press
          onPress={resume}
          scale={0.98}
          ms={220}
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: 12,
            gap: 12,
            boxShadow: SH.card,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingRight: 34,
            }}
          >
            <Photo
              hue={r.hue}
              uri={r.uri}
              radius={12}
              style={{ width: 56, height: 56 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T
                style={[
                  sans(11, 700, C.ink3),
                  { letterSpacing: em(11, 0.05), textTransform: 'uppercase' },
                ]}
              >{`Step ${ast + 1} of ${an}`}</T>
              <T
                numberOfLines={1}
                style={[serif(17, 600), { lineHeight: 20.4, marginTop: 2 }]}
              >
                {r.title}
              </T>
              <T
                numberOfLines={1}
                style={[sans(13, 400, C.ink2), { marginTop: 2 }]}
              >
                {st.t + (st.heat ? ' · ' + st.heat : '')}
              </T>
            </View>
          </View>
          <Press
            onPress={() => {
              useCook.getState().discard();
              toast('Cooking session cleared');
            }}
            scale={0.88}
            easing={CSS_EASE}
            accessibilityLabel="Discard session"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: C.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="close" size={18} color={C.ink2} />
          </Press>
          <Bars fracs={fracs} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {st.m > 0 ? (
              <Press
                onPress={() =>
                  useCook.getState().toggle(key, st.m, st.t, r.title)
                }
                scale={0.96}
                easing={CSS_EASE}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 48,
                  paddingLeft: 8,
                  paddingRight: 14,
                  borderRadius: 99,
                  backgroundColor: C.surface2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <View style={{ width: 32, height: 32 }}>
                  <Ring
                    dash={RING * (1 - AT.rem / Math.max(1, AT.total))}
                    col={ringCol}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Glyph
                      name={
                        AT.run
                          ? 'pause'
                          : AT.rem === 0
                            ? 'replay'
                            : 'play_arrow'
                      }
                      size={16}
                      color={ringCol}
                      fill
                    />
                  </View>
                </View>
                <T style={[sans(16, 700), { fontVariant: ['tabular-nums'] }]}>
                  {clock(AT.rem)}
                </T>
                <T style={sans(12, 600, C.ink2)}>
                  {AT.run ? 'left' : AT.rem === 0 ? 'done' : 'paused'}
                </T>
              </Press>
            ) : (
              <T
                numberOfLines={1}
                style={[
                  sans(13, 600, C.ink2),
                  { flex: 1, minWidth: 0, paddingLeft: 4 },
                ]}
              >
                {next}
              </T>
            )}
            <Press
              onPress={resume}
              scale={0.96}
              ms={220}
              style={{
                height: 48,
                paddingHorizontal: 20,
                borderRadius: 99,
                backgroundColor: C.terra,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                boxShadow: SH.terraCta,
              }}
            >
              <Glyph name="play_arrow" size={20} color={C.white} fill />
              <T style={sans(14, 700, C.white)}>Resume</T>
            </Press>
          </View>
        </Press>
      </>
    );
  }

  return (
    <Animated.View
      pointerEvents={show ? 'auto' : 'none'}
      style={[
        { marginHorizontal: -20, paddingHorizontal: 20, overflow: 'hidden' },
        wrap,
      ]}
    >
      <Stagger i={1} on={on}>
        {body}
      </Stagger>
    </Animated.View>
  );
}

function Ring({ dash, col }: { dash: number; col: string }) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: tw(dash, 1000, Easing.linear),
    stroke: tw(col, 300, CSS_EASE),
  }));
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Circle
        cx={16}
        cy={16}
        r={13}
        fill="none"
        stroke={C.line}
        strokeWidth={3}
      />
      <ACircle
        cx={16}
        cy={16}
        r={13}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${RING}`}
        rotation={-90}
        origin="16, 16"
        animatedProps={props}
      />
    </Svg>
  );
}

function Bars({ fracs }: { fracs: number[] }) {
  const [w, setW] = useState(0);
  const n = fracs.length;
  const bw = n ? (w - 4 * (n - 1)) / n : 0;
  return (
    <View
      style={{ flexDirection: 'row', gap: 4 }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {fracs.map((f, i) => (
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
          {w > 0 ? <BarFill width={f * bw} /> : null}
        </View>
      ))}
    </View>
  );
}

function BarFill({ width }: { width: number }) {
  const a = useAnimatedStyle(() => ({ width: tw(width, 1000, Easing.linear) }));
  return (
    <Animated.View
      style={[{ height: '100%', borderRadius: 3, backgroundColor: C.terra }, a]}
    />
  );
}

function Tonight({ on }: { on: boolean }) {
  const { list, isLoading } = useTRecipes();
  const { week } = usePlanWeek(currentMonday());
  const plannedId = week[todayIndex()]?.d ?? null;
  const id = plannedId ?? list[0]?.id ?? null;
  const { r: detail } = useTRecipe(id);
  const t: TRecipe | null = detail ?? list.find((x) => x.id === id) ?? null;
  const active = useCook((s) => s.active);
  const activeOn = useCook((s) => s.activeOn);
  const openRecipe = useNav((s) => s.openRecipe);

  if (!id && !isLoading) return null;
  const hue = t?.hue ?? hueOf(id ?? '');
  const open = () => id && openRecipe(id);

  return (
    <Stagger i={1} on={on}>
      <T style={[kicker(C.terra), { marginBottom: 10 }]}>Tonight’s dinner</T>
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: SH.card,
        }}
      >
        <Press
          onPress={open}
          scale={0.98}
          ms={260}
          style={{ height: 224, overflow: 'hidden' }}
        >
          <Photo
            hue={hue}
            uri={t?.uri}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {!t?.uri ? (
              <T
                style={[
                  mono(11, phCaption(hue)),
                  { position: 'absolute', top: 64, left: 16 },
                ]}
              >
                {'photo · ' + (t?.photo ?? '')}
              </T>
            ) : null}
          </Photo>
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(46,49,46,0)',
              'rgba(46,49,46,0)',
              'rgba(46,49,46,.2)',
              'rgba(46,49,46,.82)',
            ]}
            locations={[0, 0.28, 0.52, 1]}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              backgroundColor: 'rgba(255,255,255,.92)',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 99,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Glyph name="flare" size={15} color={C.terra} />
            <T
              style={[sans(11, 700, C.green), { letterSpacing: em(11, 0.04) }]}
            >
              Tonight’s focus
            </T>
          </View>
          <View
            style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}
          >
            {t ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(50,83,60,.85)',
                  paddingVertical: 3,
                  paddingHorizontal: 10,
                  borderRadius: 99,
                }}
              >
                <T
                  style={[
                    sans(11, 700, C.white),
                    { letterSpacing: em(11, 0.03) },
                  ]}
                >
                  {t.tag}
                </T>
              </View>
            ) : null}
            <T
              style={[
                serif(25, 600, C.bg),
                {
                  lineHeight: 28.75,
                  letterSpacing: em(25, -0.01),
                  marginTop: 6,
                },
              ]}
            >
              {t?.title ?? ''}
            </T>
          </View>
        </Press>
        <View style={{ padding: 16, gap: 14 }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Meta icon="timer" text={t ? fmtT(t.time) : ''} />
            <Meta icon="skillet" text={t?.level ?? ''} />
            <Meta icon="group" text={'Serves ' + (t?.base ?? '')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Press
              onPress={() => id && startCook(id)}
              scale={0.97}
              ms={220}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 99,
                backgroundColor: C.terra,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: SH.terraCta,
              }}
            >
              <Glyph name="local_fire_department" size={19} color={C.white} />
              <T style={sans(14, 700, C.white)}>
                {activeOn && active?.id === id
                  ? 'Resume cooking'
                  : 'Start cook mode'}
              </T>
            </Press>
            <Press
              onPress={open}
              scale={0.97}
              ms={220}
              bg={C.surface3}
              pressedBg={C.surfacePress}
              style={{
                height: 48,
                paddingHorizontal: 18,
                borderRadius: 99,
                backgroundColor: C.surface3,
                justifyContent: 'center',
              }}
            >
              <T style={sans(14, 600)}>Recipe</T>
            </Press>
          </View>
        </View>
      </View>
    </Stagger>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Glyph name={icon} size={16} color={C.greenDeep} />
      <T style={sans(12, 600, C.ink2)}>{text}</T>
    </View>
  );
}

function ThisWeek({ on }: { on: boolean }) {
  const { week, isLoading } = usePlanWeek(currentMonday());
  const goTab = useNav((s) => s.goTab);
  const mounted = useNav((s) => s.mounted);
  const [hi, setHi] = useState(todayIndex);
  const [sel, setSel] = useState(todayIndex);
  const [fade, setFade] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);

  const dates = useMemo(() => {
    const m = new Date(`${currentMonday()}T00:00:00.000Z`);
    return Array.from({ length: 7 }, (_, i) =>
      new Date(m.getTime() + i * 864e5).getUTCDate(),
    );
  }, []);

  const select = (i: number) => {
    if (i === hi) return;
    if (t.current) clearTimeout(t.current);
    setHi(i);
    setFade(true);
    t.current = setTimeout(() => {
      setSel(i);
      setFade(false);
    }, 160);
  };

  const fx = useAnimatedStyle(() => ({
    opacity: tw(fade ? 0 : 1, 160, CSS_EASE),
    transform: [{ translateY: tw(fade ? 6 : 0, 240, EASE) }],
  }));
  const wd = week[sel] ?? { b: null, l: null, d: null };

  return (
    <Stagger
      i={2}
      on={on}
      style={{
        marginTop: 28,
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <Press
        onPress={() => goTab('plan')}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <T style={serif(19, 600)}>This week</T>
        <Glyph name="chevron_right" size={18} color={C.green} />
      </Press>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {DAYLETTERS.map((l, i) => (
          <DayChip
            key={i}
            letter={l}
            n={dates[i] ?? 0}
            on={i === hi}
            day={week[i]}
            onPress={() => select(i)}
          />
        ))}
      </View>
      <Animated.View style={[{ paddingTop: 6 }, fx]}>
        <DayMeals
          day={wd}
          dayIndex={sel}
          mounted={mounted}
          weekLoading={isLoading}
        />
      </Animated.View>
    </Stagger>
  );
}

function DayChip({
  letter,
  n,
  on,
  day,
  onPress,
}: {
  letter: string;
  n: number;
  on: boolean;
  day?: { b: string | null; l: string | null; d: string | null };
  onPress: () => void;
}) {
  const bg = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.green : 'rgba(50,83,60,0)', 260, CSS_EASE),
  }));
  const col = useAnimatedStyle(() => ({
    color: tw(on ? C.bg : C.ink, 260, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 14,
      }}
      animatedStyle={bg}
    >
      <Animated.Text
        allowFontScaling={false}
        style={[sans(11, 600), { opacity: 0.75 }, col]}
      >
        {letter}
      </Animated.Text>
      <Animated.Text allowFontScaling={false} style={[sans(16, 700), col]}>
        {n}
      </Animated.Text>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {MEAL_KEYS.map((k) => (
          <View
            key={k}
            style={{
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: day?.[k]
                ? on
                  ? C.greenSoft2
                  : C.terra
                : on
                  ? 'rgba(248,250,245,.3)'
                  : C.lineStrong,
            }}
          />
        ))}
      </View>
    </Press>
  );
}

function DayMeals({
  day,
  dayIndex,
  mounted,
  weekLoading,
}: {
  day: TDay;
  dayIndex: number;
  mounted: boolean;
  weekLoading: boolean;
}) {
  const breakfast = useRecipeSlot(day.b);
  const lunch = useRecipeSlot(day.l);
  const dinner = useRecipeSlot(day.d);
  const slots = { b: breakfast, l: lunch, d: dinner };
  const pending = weekLoading || MEAL_KEYS.some((k) => slots[k].pending);
  const any = MEAL_KEYS.some((k) => slots[k].recipe);
  if (!any) {
    if (pending) return null;
    const dayName = DAYNAMES[dayIndex] ?? 'this day';
    const missing = MEAL_KEYS.some((k) => day[k]);
    return (
      <Press
        onPress={() => {
          usePlan.getState().goDate(0, dayIndex);
          useNav.getState().goTab('plan');
        }}
        scale={0.98}
        ms={220}
        bg="transparent"
        pressedBg={C.surface3}
        style={{
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 11,
          paddingLeft: 10,
          paddingRight: 14,
          borderRadius: 16,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: C.lineStrong,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: C.green,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="add" size={18} color={C.white} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={1} style={sans(14, 600, C.green)}>
            {`Plan meals for ${dayName}`}
          </T>
          <T style={[sans(12, 400, C.ink3), { marginTop: 1 }]}>
            {missing ? 'No recipes available' : 'Nothing planned yet'}
          </T>
        </View>
        <Glyph name="chevron_right" size={18} color={C.ink3} />
      </Press>
    );
  }
  return (
    <>
      {MEAL_KEYS.map((k) => (
        <MealRow
          key={k}
          label={MEAL_LABEL[k]}
          id={day[k]}
          recipe={slots[k].recipe}
          mounted={mounted}
        />
      ))}
    </>
  );
}

function MealRow({
  label,
  id,
  recipe: r,
  mounted,
}: {
  label: string;
  id: string | null;
  recipe: TRecipe | null;
  mounted: boolean;
}) {
  const openRecipe = useNav((s) => s.openRecipe);
  const on = !!r && mounted;
  const a = useAnimatedStyle(() => ({
    maxHeight: tw(on ? 60 : 0, 360),
    marginTop: tw(on ? 8 : 0, 360),
    opacity: tw(on ? 1 : 0, 260, CSS_EASE),
  }));
  return (
    <Animated.View
      pointerEvents={on ? 'auto' : 'none'}
      style={[{ overflow: 'hidden' }, a]}
    >
      <Press
        onPress={() => id && openRecipe(id)}
        scale={0.98}
        easing={CSS_EASE}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: C.surface,
          borderRadius: 12,
          padding: 8,
        }}
      >
        <Photo
          hue={r ? r.hue : 0}
          uri={r?.uri}
          radius={10}
          style={{ width: 40, height: 40 }}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <T
            style={[
              sans(10, 700, C.ink3),
              { letterSpacing: em(10, 0.05), textTransform: 'uppercase' },
            ]}
          >
            {label}
          </T>
          <T numberOfLines={1} style={[serif(14, 600), { lineHeight: 17.5 }]}>
            {r?.title ?? ''}
          </T>
        </View>
        <T style={sans(11, 400, C.ink2)}>{r ? fmtT(r.time) : ''}</T>
      </Press>
    </Animated.View>
  );
}

function CookAgain({ on }: { on: boolean }) {
  const { list, isLoading } = useTRecipes();
  const goTab = useNav((s) => s.goTab);
  const openRecipe = useNav((s) => s.openRecipe);
  const again = useMemo(() => {
    const cooked = list
      .filter((r) => r.cooked > 0)
      .sort((a, b) => b.cooked - a.cooked);
    const ids = new Set(cooked.map((r) => r.id));
    return [...cooked, ...list.filter((r) => !ids.has(r.id))].slice(0, 4);
  }, [list]);

  if (!again.length && !isLoading) return null;
  const cards: (TRecipe | null)[] = again.length
    ? again
    : [null, null, null, null];

  return (
    <Stagger i={4} on={on} style={{ marginTop: 30 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <T style={serif(21, 600)}>Cook again</T>
        <Press onPress={() => goTab('cookbook')}>
          <T style={sans(13, 600, C.green)}>Cookbook</T>
        </Press>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={162}
        decelerationRate="fast"
        style={{ marginRight: -20 }}
        contentContainerStyle={{ gap: 12, paddingRight: 20, paddingBottom: 4 }}
      >
        {cards.map((r, i) => {
          const hue = r?.hue ?? (i * 37) % 360;
          return (
            <Press
              key={r?.id ?? i}
              onPress={() => r && openRecipe(r.id)}
              scale={0.97}
              ms={240}
              style={{ width: 150 }}
            >
              <Photo
                hue={hue}
                uri={r?.uri}
                caption="photo"
                captionSize={10}
                radius={16}
                style={{ height: 150 }}
              />
              <T style={[serif(16, 600), { lineHeight: 19.2, marginTop: 8 }]}>
                {r?.title ?? ''}
              </T>
              <T style={[sans(12, 400, C.ink2), { marginTop: 3 }]}>
                {r ? fmtT(r.time) : ''}
              </T>
            </Press>
          );
        })}
      </ScrollView>
    </Stagger>
  );
}
