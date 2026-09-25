import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { timerKey, useCook, type StepTimer } from '@/tortie/cook-store';
import { useCookSessionSync } from '@/tortie/data/cook-session';
import { useServings } from '@/tortie/data/recipe-ui';
import {
  fmtQ,
  useTRecipe,
  type TDetail,
  type TIng,
  type TStep,
} from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { clock, fmtT } from '@/tortie/lib/fmt';
import { useMotion } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import { C, CSS_EASE, EASE, SPRING } from '@/tortie/theme';
import { tw, useOpenProgress, useSlideUp } from '@/tortie/ui/anim';
import { TORTIE_LOGO } from '@/tortie/ui/art';
import { Glyph } from '@/tortie/ui/icon';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const RING = 326.73;
const MINI_RING = 69.12;
const KEEP_AWAKE_TAG = 'tortie-cook';
const ACircle = Animated.createAnimatedComponent(Circle);

const ingQ = (x: TIng, scale: number) =>
  x.q ? fmtQ(x.q * scale) + (x.u ? ' ' + x.u : '') : x.u || '';
const splitKey = (k: string): [string, number] => {
  const i = k.lastIndexOf(':');
  return [k.slice(0, i), +k.slice(i + 1)];
};
const timerOf = (timers: Record<string, StepTimer>, key: string, m: number) =>
  timers[key] ?? {
    rem: m * 60,
    total: m * 60,
    run: false,
    title: '',
    recipeTitle: '',
  };

export function CookMode() {
  const open = useNav((s) => s.cookOpen);
  const cookId = useNav((s) => s.cookId);
  const nonce = useNav((s) => s.cookNonce);
  const { m } = useMotion();
  const ms = Math.round(560 * m);
  const { width } = useWindowDimensions();
  const f = useFrame();
  const { r: loaded } = useTRecipe(cookId);
  const r = loaded && loaded.id === cookId ? loaded : null;
  const [serv, setServ] = useServings(cookId, r?.base ?? 2);
  const timers = useCook((s) => s.timers);
  const sessionId = useCook((s) => s.sessionId);
  const keepAwake = useTortiePrefs((s) => s.keepAwake);
  const sync = useCookSessionSync();

  const [step, setStep] = useState(0);
  const [intro, setIntro] = useState(false);
  const [done, setDone] = useState(false);
  const [bodyW, setBodyW] = useState(width);

  const [seen, setSeen] = useState(nonce);
  if (nonce !== seen) {
    setSeen(nonce);
    const c = useCook.getState();
    const same = c.resumed && !!c.active && c.active.id === cookId;
    setStep(same ? c.active!.step : 0);
    setIntro(!same);
    setDone(false);
  }

  const n = r?.steps.length ?? 0;
  const cur = n ? Math.min(step, n - 1) : 0;

  useEffect(() => {
    if (!nonce) return;
    const s = useNav.getState();
    if (!s.cookOpen || !s.cookId) return;
    const c = useCook.getState();
    sync.open(
      s.cookId,
      c.resumed && c.active?.id === s.cookId ? c.active.step : 0,
    );
  }, [nonce, sync]);

  useEffect(() => {
    if (!open || !cookId || !n) return;
    const c = useCook.getState();
    if (c.active?.id === cookId && c.active.step !== cur) c.setStep(cur);
    if (!sessionId) return;
    const t = setTimeout(() => sync.step(sessionId, cur), 300);
    return () => clearTimeout(t);
  }, [open, cookId, cur, n, sessionId, sync]);

  const finished = useRef(false);
  const saved = n ? cur : step;
  const last = useRef({ open, cookId, saved, done });
  useEffect(() => {
    const prev = last.current;
    last.current = { open, cookId, saved, done };
    if (!prev.open || open || !prev.cookId) return;
    if (finished.current) {
      finished.current = false;
      return;
    }
    const c = useCook.getState();
    if (prev.done) {
      const sid = c.sessionId;
      c.end();
      sync.stop(prev.cookId, sid).catch(() => undefined);
    } else c.keep(prev.cookId, prev.saved);
  }, [open, cookId, saved, done, sync]);

  useEffect(() => {
    if (!open || !keepAwake) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [open, keepAwake]);

  useEffect(
    () =>
      useCook.subscribe((s, p) => {
        if (!useTortiePrefs.getState().timerAlerts) return;
        for (const k in s.timers) {
          const o = p.timers[k];
          if (o && o.run && o.rem > 0 && s.timers[k]!.rem === 0) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => undefined);
            return;
          }
        }
      }),
    [],
  );

  const p = useOpenProgress(open, ms);
  const slide = useSlideUp(p);
  const track = useAnimatedStyle(() => ({
    transform: [{ translateX: tw(-cur * bodyW, ms, EASE) }],
  }));
  const introA = useAnimatedStyle(() => ({
    opacity: tw(intro ? 1 : 0, 360, CSS_EASE),
    transform: [{ translateX: tw(intro ? 0 : -24, ms, EASE) }],
  }));
  const doneA = useAnimatedStyle(() => ({
    opacity: tw(done ? 1 : 0, 400, CSS_EASE),
  }));

  const close = () => useNav.getState().closeCook();
  const goStep = (i: number) => {
    setStep(i);
    setDone(false);
    setIntro(false);
  };
  const prev = () => {
    if (done) setDone(false);
    else if (intro) return;
    else if (cur === 0) setIntro(true);
    else setStep(cur - 1);
  };
  const next = () => {
    if (intro) {
      setIntro(false);
      setStep(0);
      if (!n) setDone(true);
      return;
    }
    if (done) {
      if (!cookId) return;
      finished.current = true;
      const c = useCook.getState();
      const sid = c.sessionId;
      c.end();
      close();
      toast('Logged to your cooking history');
      sync.finish(cookId, sid).catch(() => undefined);
      return;
    }
    if (cur < n - 1) setStep(cur + 1);
    else setDone(true);
  };

  const scale = r ? serv / r.base : 1;
  const nextLabel = intro
    ? 'Start cooking'
    : done
      ? 'Finish'
      : cur < n - 1
        ? 'Next step'
        : 'I’m done';
  const nextBg = done || cur === n - 1 ? C.green : C.terra;
  const count = done ? '✓' : intro ? '' : `${cur + 1}/${n}`;

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      onLayout={slide.onLayout}
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          backgroundColor: C.bg,
        },
        slide.style,
      ]}
    >
      <View style={{ paddingTop: f.pushTop, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <RoundBtn icon="close" onPress={close} label="Close cook mode" />
          <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
            <T
              style={sans(11, 700, C.terra, {
                letterSpacing: em(11, 0.08),
                textTransform: 'uppercase',
              })}
            >
              Cook mode
            </T>
            <T numberOfLines={1} style={serif(17, 600)}>
              {r?.title ?? ''}
            </T>
          </View>
          <T style={sans(14, 700, C.ink2, { width: 42, textAlign: 'right' })}>
            {count}
          </T>
        </View>
        <Bars
          n={n}
          filled={(i) => done || (!intro && i <= cur)}
          onPress={goStep}
        />
      </View>

      <View
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        onLayout={(e) => setBodyW(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              height: '100%',
              width: Math.max(1, n) * bodyW,
            },
            track,
          ]}
        >
          {r?.steps.map((st, i) => (
            <StepPage
              key={i}
              r={r}
              st={st}
              i={i}
              on={i === cur}
              w={bodyW}
              ms={ms}
              scale={scale}
              timer={timerOf(timers, timerKey(r.id, i), st.m)}
            />
          ))}
        </Animated.View>

        <Animated.View
          pointerEvents={intro ? 'auto' : 'none'}
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: C.bg,
            },
            introA,
          ]}
        >
          <Intro r={r} scale={scale} />
        </Animated.View>

        <Animated.View
          pointerEvents={done ? 'auto' : 'none'}
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: C.bg,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
            },
            doneA,
          ]}
        >
          <DoneLogo done={done} />
          <T
            style={serif(40, 500, C.ink, {
              letterSpacing: em(40, -0.02),
              marginTop: 22,
              lineHeight: 44,
              textAlign: 'center',
            })}
          >
            Buon appetito.
          </T>
          <T
            style={sans(16, 400, C.ink2, {
              lineHeight: 24,
              marginTop: 10,
              textAlign: 'center',
            })}
          >
            {(r?.title ?? '') + ' is served. Enjoy every bite.'}
          </T>
        </Animated.View>

        <Dock
          open={open}
          cookId={cookId}
          r={r}
          timers={timers}
          visibleKey={
            open && !intro && !done && cookId ? timerKey(cookId, cur) : null
          }
          onGo={(id, si) => {
            if (id !== cookId) {
              useCook.getState().begin(id);
              useNav.getState().openCook(id);
            } else goStep(si);
          }}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: f.sheetBottom,
          borderTopWidth: 1,
          borderTopColor: C.line,
          backgroundColor: 'rgba(248,250,245,.9)',
        }}
      >
        {intro ? (
          <View
            style={{
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              backgroundColor: C.white,
              borderWidth: 1.5,
              borderColor: C.line,
              borderRadius: 99,
              paddingHorizontal: 5,
            }}
          >
            <ServBtn
              icon="remove"
              label="Fewer portions"
              onPress={() => setServ(serv - 1)}
            />
            <View style={{ minWidth: 58, alignItems: 'center' }}>
              <T style={serif(21, 600, C.ink, { lineHeight: 21 })}>
                {String(serv)}
              </T>
              <T
                style={sans(10, 700, C.ink2, { lineHeight: 10, marginTop: 2 })}
              >
                portions
              </T>
            </View>
            <ServBtn
              icon="add"
              label="More portions"
              onPress={() => setServ(serv + 1)}
            />
          </View>
        ) : (
          <BackBtn dim={done} onPress={prev} />
        )}
        <NextBtn
          label={nextLabel}
          icon={done ? 'check' : 'arrow_forward'}
          bg={nextBg}
          onPress={next}
        />
      </View>
    </Animated.View>
  );
}

function RoundBtn({
  icon,
  onPress,
  label,
}: {
  icon: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      scale={0.9}
      easing={CSS_EASE}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
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

function Bars({
  n,
  filled,
  onPress,
}: {
  n: number;
  filled: (i: number) => boolean;
  onPress: (i: number) => void;
}) {
  const [w, setW] = useState(0);
  const bw = n ? (w - 5 * (n - 1)) / n : 0;
  return (
    <View
      style={{ flexDirection: 'row', gap: 5, marginTop: 16 }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {Array.from({ length: n }, (_, i) => (
        <Press
          key={i}
          onPress={() => onPress(i)}
          hitSlop={{ top: 10, bottom: 10 }}
          accessibilityLabel={`Step ${i + 1}`}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            backgroundColor: C.surface3,
            overflow: 'hidden',
          }}
        >
          <BarFill w={filled(i) ? bw : 0} />
        </Press>
      ))}
    </View>
  );
}

function BarFill({ w }: { w: number }) {
  const a = useAnimatedStyle(() => ({ width: tw(w, 500, EASE) }));
  return (
    <Animated.View
      style={[{ height: '100%', borderRadius: 3, backgroundColor: C.terra }, a]}
    />
  );
}

function StepPage({
  r,
  st,
  i,
  on,
  w,
  ms,
  scale,
  timer,
}: {
  r: TDetail;
  st: TStep;
  i: number;
  on: boolean;
  w: number;
  ms: number;
  scale: number;
  timer: StepTimer;
}) {
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0.2, ms, CSS_EASE),
  }));
  const key = timerKey(r.id, i);
  return (
    <Animated.View style={[{ width: w, height: '100%' }, a]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 26,
          paddingHorizontal: 22,
          paddingBottom: 120,
        }}
      >
        <T style={sans(13, 700, C.terra)}>{`Step ${i + 1}`}</T>
        <T
          style={serif(34, 500, C.ink, {
            lineHeight: 37.4,
            letterSpacing: em(34, -0.02),
            marginTop: 6,
          })}
        >
          {st.t}
        </T>
        {st.d ? (
          <T style={sans(19, 400, C.ink, { lineHeight: 30.4, marginTop: 14 })}>
            {st.d}
          </T>
        ) : null}
        {st.need.length ? (
          <>
            <T
              style={sans(11, 700, C.ink2, {
                letterSpacing: em(11, 0.06),
                textTransform: 'uppercase',
                marginTop: 22,
              })}
            >
              You’ll need
            </T>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 8,
              }}
            >
              {st.need.map((j) => {
                const x = r.ings[j];
                if (!x) return null;
                return (
                  <View
                    key={j}
                    style={{
                      flexDirection: 'row',
                      gap: 4,
                      maxWidth: '100%',
                      backgroundColor: C.surface3,
                      borderRadius: 16,
                      paddingVertical: 7,
                      paddingHorizontal: 13,
                    }}
                  >
                    <T style={sans(14, 700, C.ink, { lineHeight: 18.9 })}>
                      {ingQ(x, scale)}
                    </T>
                    <T
                      style={sans(14, 400, C.ink, {
                        lineHeight: 18.9,
                        flexShrink: 1,
                      })}
                    >
                      {x.n}
                    </T>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
        {st.m > 0 ? (
          <TimerCard
            tkey={key}
            m={st.m}
            title={st.t}
            recipeTitle={r.title}
            T0={timer}
          />
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

function TimerCard({
  tkey,
  m,
  title,
  recipeTitle,
  T0,
}: {
  tkey: string;
  m: number;
  title: string;
  recipeTitle: string;
  T0: StepTimer;
}) {
  const btnBg = useAnimatedStyle(() => ({
    backgroundColor: tw(T0.run ? C.ink : C.green, 300, CSS_EASE),
  }));
  const label = T0.run
    ? 'Pause'
    : T0.rem < T0.total && T0.rem > 0
      ? 'Resume'
      : T0.rem === 0
        ? 'Again'
        : 'Start';
  const cook = useCook.getState;
  return (
    <View
      style={{
        marginTop: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 28,
        padding: 16,
        boxShadow: '0 16px 36px -18px rgba(44,52,45,.2)',
      }}
    >
      <View style={{ width: 120, height: 120 }}>
        <BigRing dash={RING * (1 - T0.rem / Math.max(1, T0.total))} />
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
          <T
            style={serif(28, 600, C.ink, {
              fontVariant: ['tabular-nums'],
              letterSpacing: em(28, -0.01),
            })}
          >
            {clock(T0.rem)}
          </T>
          <T style={sans(11, 600, C.ink2)}>
            {'of ' + fmtT(Math.round(T0.total / 60))}
          </T>
        </View>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Press
          onPress={() => cook().toggle(tkey, m, title, recipeTitle)}
          scale={0.96}
          easing={CSS_EASE}
          animatedStyle={btnBg}
          style={{
            height: 46,
            borderRadius: 99,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Glyph
            name={T0.run ? 'pause' : 'play_arrow'}
            size={21}
            color={C.bg}
            fill
          />
          <T style={sans(15, 700, C.bg)}>{label}</T>
        </Press>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Press
            onPress={() => cook().bump(tkey, m, title, recipeTitle)}
            scale={0.94}
            easing={CSS_EASE}
            style={{
              flex: 1,
              height: 40,
              borderWidth: 1.5,
              borderColor: C.line,
              borderRadius: 99,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(13, 700)}>+1 min</T>
          </Press>
          <Press
            onPress={() => cook().reset(tkey, m)}
            accessibilityLabel="Reset timer"
            scale={0.94}
            easing={CSS_EASE}
            style={{
              flex: 1,
              height: 40,
              borderWidth: 1.5,
              borderColor: C.line,
              borderRadius: 99,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="restart_alt" size={19} color={C.ink} />
          </Press>
        </View>
      </View>
    </View>
  );
}

function BigRing({ dash }: { dash: number }) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: tw(dash, 1000, Easing.linear),
  }));
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle
        cx={60}
        cy={60}
        r={52}
        fill="none"
        stroke={C.surface3}
        strokeWidth={8}
      />
      <ACircle
        cx={60}
        cy={60}
        r={52}
        fill="none"
        stroke={C.terra}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${RING}`}
        rotation={-90}
        origin="60, 60"
        animatedProps={props}
      />
    </Svg>
  );
}

function Intro({ r, scale }: { r: TDetail | null; scale: number }) {
  const label = sans(11, 700, C.ink2, {
    letterSpacing: em(11, 0.06),
    textTransform: 'uppercase',
  });
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 22,
        paddingHorizontal: 20,
        paddingBottom: 20,
      }}
    >
      <Photo
        hue={r?.hue ?? 0}
        uri={r?.uri}
        caption={r ? 'photo · ' + r.photo : undefined}
        captionSize={11}
        captionStyle={{ left: 14, bottom: 14 }}
        radius={24}
        style={{ height: 168 }}
      />
      <T
        style={serif(30, 500, C.ink, {
          lineHeight: 33,
          letterSpacing: em(30, -0.02),
          marginTop: 18,
        })}
      >
        {r?.title ?? ''}
      </T>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          rowGap: 6,
          columnGap: 14,
          marginTop: 10,
        }}
      >
        {(r ? [fmtT(r.time), r.level, r.steps.length + ' steps'] : []).map(
          (x, i) => (
            <T key={i} style={sans(13, 600, C.ink2)}>
              {x}
            </T>
          ),
        )}
      </View>
      <T style={[label, { marginTop: 24 }]}>Ingredients</T>
      <View style={{ marginTop: 6 }}>
        {r?.ings.map((x, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: C.surface3,
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: x.tint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T style={{ fontSize: 16, lineHeight: 20, textAlign: 'center' }}>
                {x.emo}
              </T>
            </View>
            <T
              style={sans(15, 700, C.ink, { lineHeight: 20.25, minWidth: 72 })}
            >
              {ingQ(x, scale)}
            </T>
            <T style={sans(15, 400, C.ink, { lineHeight: 20.25, flex: 1 })}>
              {x.n}
            </T>
          </View>
        ))}
      </View>
      <T style={[label, { marginTop: 26 }]}>Steps</T>
      <View style={{ gap: 16, marginTop: 12 }}>
        {r?.steps.map((st, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: C.surface3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T style={sans(13, 700)}>{String(i + 1)}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}
              >
                <T style={sans(16, 700, C.ink, { flex: 1, lineHeight: 20.8 })}>
                  {st.t}
                </T>
                {st.m > 0 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Glyph name="timer" size={15} color={C.terra} />
                    <T style={sans(12, 600, C.terra)}>{fmtT(st.m)}</T>
                  </View>
                ) : null}
              </View>
              {st.d ? (
                <T
                  style={sans(14, 400, C.ink2, {
                    lineHeight: 21,
                    marginTop: 3,
                  })}
                >
                  {st.d}
                </T>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function DoneLogo({ done }: { done: boolean }) {
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(done ? 1 : 0, { duration: 700, easing: SPRING });
  }, [done, p]);
  const a = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.6 + 0.4 * p.value },
      { rotate: `${-12 * (1 - p.value)}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        { width: 96, height: 96, borderRadius: 26, overflow: 'hidden' },
        a,
      ]}
    >
      <Image
        source={TORTIE_LOGO}
        style={{ width: 96, height: 96 }}
        contentFit="cover"
      />
    </Animated.View>
  );
}

type DockTheme = {
  bg: string;
  col: string;
  sub: string;
  bd: string;
  track: string;
  ring: string;
  btn2: string;
};
const RUN: DockTheme = {
  bg: C.ink,
  col: C.bg,
  sub: C.lineStrong,
  bd: C.ink,
  track: 'rgba(248,250,245,.18)',
  ring: C.terraBright,
  btn2: 'rgba(248,250,245,.12)',
};
const DONE: DockTheme = {
  bg: C.terra,
  col: C.white,
  sub: C.terraSoft,
  bd: C.terra,
  track: 'rgba(255,255,255,.25)',
  ring: C.white,
  btn2: 'rgba(255,255,255,.16)',
};
const PAUSED: DockTheme = {
  bg: C.white,
  col: C.ink,
  sub: C.ink2,
  bd: C.line,
  track: C.surface3,
  ring: C.ink3,
  btn2: C.surface2,
};

function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

/** Timer dock: running / partly used timers except the one on the visible step. */
function Dock({
  open,
  cookId,
  r,
  timers,
  visibleKey,
  onGo,
}: {
  open: boolean;
  cookId: string | null;
  r: TDetail | null;
  timers: Record<string, StepTimer>;
  visibleKey: string | null;
  onGo: (id: string, step: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const x = useRef(0);
  const raf = useRef<number | null>(null);
  const [dockW, setDockW] = useState(0);
  const [tExp, setTExp] = useState<string | null>(null);
  const [tExpW, setTExpW] = useState(362);

  useEffect(
    () => () => void (raf.current != null && cancelAnimationFrame(raf.current)),
    [],
  );
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setTExp(null);
  }

  const keys = Object.keys(timers)
    .filter((k) => {
      const t = timers[k]!;
      return (t.run || t.rem < t.total) && k !== visibleKey;
    })
    .sort((a, b) => {
      const [ia, sa] = splitKey(a);
      const [ib, sb] = splitKey(b);
      return (
        (ia === cookId ? 0 : 1) - (ib === cookId ? 0 : 1) ||
        ia.localeCompare(ib) ||
        sa - sb
      );
    });

  const expand = (k: string, idx: number) => {
    const W = dockW ? Math.min(420, dockW - 28) : 362;
    setTExp(k);
    setTExpW(W);
    if (!dockW) return;
    const contentW = 28 + W + (keys.length - 1) * 154;
    const to = Math.min(idx * 154, Math.max(0, contentW - dockW));
    const from = x.current;
    let t0 = -1;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    const tick = (now: number) => {
      if (t0 < 0) t0 = now;
      const q = Math.min(1, (now - t0) / 440);
      const v = from + (to - from) * easeOutCubic(q);
      x.current = v;
      ref.current?.scrollTo({ x: v, animated: false });
      if (q < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5 }}
      onLayout={(e) => setDockW(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={ref}
        horizontal
        pointerEvents="box-none"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          x.current = e.nativeEvent.contentOffset.x;
        }}
        contentContainerStyle={{
          flexGrow: 1,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          gap: 8,
          paddingTop: 24,
          paddingHorizontal: 14,
          paddingBottom: 12,
        }}
      >
        {keys.map((k, idx) => {
          const [id, si] = splitKey(k);
          const t = timers[k]!;
          const other = id !== cookId;
          const title = !other && r ? (r.steps[si]?.t ?? t.title) : t.title;
          const cook = useCook.getState;
          return (
            <DockPill
              key={k}
              t={t}
              n={si + 1}
              exp={tExp === k}
              ew={tExpW}
              title={title}
              kicker={
                'Step ' +
                (si + 1) +
                ' timer' +
                (other ? ' · ' + t.recipeTitle : '')
              }
              onExpand={() => expand(k, idx)}
              onCollapse={() => setTExp(null)}
              onDismiss={() => {
                cook().dismiss(k);
                setTExp(null);
              }}
              onPlus={() => cook().plus(k)}
              onToggle={() =>
                cook().toggle(k, t.total / 60, t.title, t.recipeTitle)
              }
              onGo={() => {
                setTExp(null);
                onGo(id, si);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function DockPill({
  t,
  n,
  exp,
  ew,
  title,
  kicker,
  onExpand,
  onCollapse,
  onDismiss,
  onPlus,
  onToggle,
  onGo,
}: {
  t: StepTimer;
  n: number;
  exp: boolean;
  ew: number;
  title: string;
  kicker: string;
  onExpand: () => void;
  onCollapse: () => void;
  onDismiss: () => void;
  onPlus: () => void;
  onToggle: () => void;
  onGo: () => void;
}) {
  const done = t.rem === 0;
  const th = t.run ? RUN : done ? DONE : PAUSED;
  const lbl = t.run ? 'left' : done ? 'Done' : 'Paused';
  const box = useAnimatedStyle(() => ({
    width: tw(exp ? ew : 146, 440, EASE),
    height: tw(exp ? 158 : 44, 440, EASE),
    borderRadius: tw(exp ? 26 : 22, 440, EASE),
    backgroundColor: tw(th.bg, 300, CSS_EASE),
    borderColor: tw(th.bd, 300, CSS_EASE),
  }));
  const cA = useAnimatedStyle(() => ({
    opacity: tw(exp ? 0 : 1, 180, CSS_EASE),
  }));
  const eA = useAnimatedStyle(() => ({
    opacity: tw(exp ? 1 : 0, 260, CSS_EASE, exp ? 160 : 0),
  }));
  const small = {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: th.btn2,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return (
    <Animated.View
      style={[
        {
          overflow: 'hidden',
          borderWidth: 1,
          boxShadow: '0 14px 32px -14px rgba(28,30,28,.5)',
        },
        box,
      ]}
    >
      <Animated.View
        pointerEvents={exp ? 'none' : 'auto'}
        style={[{ position: 'absolute', left: 0, bottom: 0 }, cA]}
      >
        <Press
          onPress={onExpand}
          accessibilityLabel={kicker}
          style={{
            width: 144,
            height: 42,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 6,
            paddingRight: 12,
          }}
        >
          <View style={{ width: 30, height: 30 }}>
            <MiniRing
              dash={MINI_RING * (1 - t.rem / Math.max(1, t.total))}
              track={th.track}
              ring={th.ring}
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
              <T style={sans(10, 700, th.col)}>{String(n)}</T>
            </View>
          </View>
          <T
            numberOfLines={1}
            style={sans(15, 700, th.col, { fontVariant: ['tabular-nums'] })}
          >
            {clock(t.rem)}
          </T>
          <T numberOfLines={1} style={sans(11, 600, th.col, { opacity: 0.8 })}>
            {lbl}
          </T>
        </Press>
      </Animated.View>

      <Animated.View
        pointerEvents={exp ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: ew,
            height: 156,
            paddingTop: 14,
            paddingRight: 14,
            paddingBottom: 14,
            paddingLeft: 18,
            justifyContent: 'space-between',
          },
          eA,
        ]}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <T
              numberOfLines={1}
              style={sans(11, 700, th.sub, {
                letterSpacing: em(11, 0.08),
                textTransform: 'uppercase',
              })}
            >
              {kicker}
            </T>
            <T
              numberOfLines={2}
              style={serif(21, 500, th.col, { lineHeight: 25.2, marginTop: 3 })}
            >
              {title}
            </T>
          </View>
          <Press
            onPress={onDismiss}
            accessibilityLabel="Dismiss timer"
            style={small}
          >
            <Glyph name="close" size={19} color={th.col} />
          </Press>
          <Press
            onPress={onCollapse}
            accessibilityLabel="Collapse timer"
            style={small}
          >
            <Glyph name="expand_more" size={21} color={th.col} />
          </Press>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <T
              style={serif(34, 600, th.col, {
                lineHeight: 34,
                fontVariant: ['tabular-nums'],
                letterSpacing: em(34, -0.01),
              })}
            >
              {clock(t.rem)}
            </T>
            <T style={sans(12, 600, th.sub)}>{lbl}</T>
          </View>
          <Press
            onPress={onPlus}
            scale={0.94}
            easing={CSS_EASE}
            style={{
              height: 44,
              paddingHorizontal: 14,
              borderRadius: 99,
              backgroundColor: th.btn2,
              justifyContent: 'center',
            }}
          >
            <T numberOfLines={1} style={sans(13, 700, th.col)}>
              +1 min
            </T>
          </Press>
          <Press
            onPress={onToggle}
            accessibilityLabel={t.run ? 'Pause timer' : 'Start timer'}
            scale={0.92}
            easing={CSS_EASE}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: th.col,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph
              name={t.run ? 'pause' : done ? 'replay' : 'play_arrow'}
              size={22}
              color={th.bg}
              fill
            />
          </Press>
          <Press
            onPress={onGo}
            accessibilityLabel="Go to step"
            scale={0.92}
            easing={CSS_EASE}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: th.btn2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="arrow_forward" size={22} color={th.col} />
          </Press>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function MiniRing({
  dash,
  track,
  ring,
}: {
  dash: number;
  track: string;
  ring: string;
}) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: tw(dash, 1000, Easing.linear),
    stroke: tw(ring, 300, CSS_EASE),
  }));
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Circle
        cx={15}
        cy={15}
        r={11}
        fill="none"
        stroke={track}
        strokeWidth={3}
      />
      <ACircle
        cx={15}
        cy={15}
        r={11}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${MINI_RING}`}
        rotation={-90}
        origin="15, 15"
        animatedProps={props}
      />
    </Svg>
  );
}

function ServBtn({
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
      accessibilityLabel={label}
      scale={0.9}
      easing={CSS_EASE}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: C.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={20} color={C.ink} />
    </Press>
  );
}

function BackBtn({ dim, onPress }: { dim: boolean; onPress: () => void }) {
  const a = useAnimatedStyle(() => ({
    opacity: tw(dim ? 0.35 : 1, 300, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Previous step"
      scale={0.92}
      easing={CSS_EASE}
      animatedStyle={a}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: C.line,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name="arrow_back" size={24} color={C.ink} />
    </Press>
  );
}

function NextBtn({
  label,
  icon,
  bg,
  onPress,
}: {
  label: string;
  icon: string;
  bg: string;
  onPress: () => void;
}) {
  const a = useAnimatedStyle(() => ({
    backgroundColor: tw(bg, 300, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      scale={0.97}
      easing={CSS_EASE}
      animatedStyle={a}
      style={{
        flex: 1,
        minWidth: 0,
        height: 56,
        borderRadius: 99,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 18,
      }}
    >
      <T numberOfLines={1} style={sans(15, 700, C.bg, { flexShrink: 1 })}>
        {label}
      </T>
      <Glyph name={icon} size={22} color={C.bg} />
    </Press>
  );
}
