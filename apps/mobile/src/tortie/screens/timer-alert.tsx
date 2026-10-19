import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useCook, type StepTimer } from '@/tortie/cook-store';
import { useTRecipe } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { clock } from '@/tortie/lib/fmt';
import { useMotion } from '@/tortie/motion';
import { useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import { C, CSS_EASE, EASE_IN_OUT } from '@/tortie/theme';
import { alertingKeys, overSec, splitTimerKey } from '@/tortie/timer-clock';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const FLASH_MS = 1100;

/** Wall clock, refreshed every `ms` while `on` (an alerting clock counts past zero). */
export function useNow(ms: number, on = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ms, on]);
  return now;
}

/** "−1:05" for a timer past zero. */
export const overClock = (t: StepTimer, now: number) =>
  '−' + clock(overSec(t, now));

/** Gentle 0 ↔ 1 pulse while `on`; a steady 1 with reduced motion. */
export function useFlash(on: boolean): SharedValue<number> {
  const { reduced } = useMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(p);
    if (!on) {
      p.value = withTiming(0, { duration: 200 });
      return;
    }
    if (reduced) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withRepeat(
      withTiming(1, { duration: FLASH_MS, easing: EASE_IN_OUT }),
      -1,
      true,
    );
    return () => cancelAnimation(p);
  }, [on, reduced, p]);
  return p;
}

export const useSnoozeLabel = () =>
  'Snooze ' + useTortiePrefs((s) => s.snoozeMinutes) + ' min';

type NavState = ReturnType<typeof useNav.getState>;

/** Cook mode is the top layer, so its card or dock shows the alert instead. */
const cookOnTop = (s: NavState) =>
  s.cookOpen &&
  !s.clipOn &&
  !(s.notesOn && s.notesOverCook) &&
  !s.welcome &&
  !s.au &&
  !s.cam &&
  !s.shareOpen;

/**
 * Android back while the full-screen alert is up: closes a stopped one, and
 * otherwise does nothing so the layer hidden under it doesn't pop.
 */
export function timerAlertBack(): boolean {
  const nav = useNav.getState();
  if (cookOnTop(nav)) return false;
  if (nav.timerHeld) {
    nav.set({ timerHeld: null });
    return true;
  }
  return alertingKeys(useCook.getState().timers).length > 0;
}

/**
 * Full-screen alert for a finished timer while cook mode isn't on screen
 * (another tab, a recipe, or coming back from outside the app). Snooze closes
 * it; Stop silences the timer but keeps the screen up so the cook can go to
 * the step. Several finished timers show one after another.
 */
export function TimerAlert() {
  const f = useFrame();
  const timers = useCook((s) => s.timers);
  const held = useNav((s) => s.timerHeld);
  const covered = useNav(cookOnTop);
  const keys = alertingKeys(timers);
  const shown = held?.key ?? keys[0] ?? null;
  const on = !!shown && !covered;

  // Cook mode took over (e.g. "Go to step" or the dock): the stopped screen is done.
  useEffect(() => {
    if (covered && held) useNav.getState().set({ timerHeld: null });
  }, [covered, held]);

  // Keep the last timer's content while the screen fades out.
  const [key, setKey] = useState(shown);
  if (shown && shown !== key) setKey(shown);
  const stopped = !!held && held.key === key;
  const parts = key ? splitTimerKey(key) : null;
  const t = key ? timers[key] : undefined;
  const { r } = useTRecipe(on ? parts?.recipeId : null);
  const st = r && parts ? r.steps[parts.step] : undefined;
  const now = useNow(1000, on && !stopped);
  const snoozeLabel = useSnoozeLabel();

  const wrap = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0, 260, CSS_EASE),
    transform: [{ translateY: tw(on ? 0 : 24, 320, CSS_EASE) }],
  }));

  const nav = useNav.getState;
  const stop = () => {
    if (!key) return;
    nav().set({ timerHeld: { key, over: t ? overSec(t, Date.now()) : 0 } });
    useCook.getState().stop(key);
  };
  const close = () => nav().set({ timerHeld: null });
  const goStep = () => {
    if (!parts) return;
    nav().set({ timerHeld: null });
    const c = useCook.getState();
    c.begin(parts.recipeId);
    c.setStep(parts.step);
    nav().openCook(parts.recipeId);
  };

  const title = st?.t ?? t?.title ?? '';
  const recipeTitle = r?.title ?? t?.recipeTitle ?? '';
  const stepLabel = parts
    ? (st?.ahead ? 'Before you start' : 'Step ' + (parts.step + 1)) +
      (st?.heat ? ' · ' + st.heat : '')
    : '';
  const more = keys.filter((k) => k !== key).length;
  const over = stopped ? held!.over : t ? overSec(t, now) : 0;

  return (
    <Animated.View
      pointerEvents={on ? 'auto' : 'none'}
      accessibilityViewIsModal={on}
      accessibilityElementsHidden={!on}
      importantForAccessibility={on ? 'auto' : 'no-hide-descendants'}
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 68,
          backgroundColor: C.white,
          paddingTop: f.pushTop + 6,
          paddingHorizontal: 20,
          paddingBottom: f.sheetBottom,
        },
        wrap,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 42,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <T
            style={sans(11, 700, C.terra, {
              letterSpacing: em(11, 0.1),
              textTransform: 'uppercase',
            })}
          >
            {more > 0 ? 'Cooking timer · +' + more + ' more' : 'Cooking timer'}
          </T>
          <T numberOfLines={1} style={serif(17, 600, C.ink)}>
            {recipeTitle}
          </T>
        </View>
        {stopped ? (
          <Press
            onPress={close}
            accessibilityLabel="Close"
            scale={0.9}
            easing={CSS_EASE}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: C.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="close" size={22} color={C.ink} />
          </Press>
        ) : null}
      </View>

      <View style={{ flex: 1, minHeight: 0, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <RingingClock ringing={on && !stopped} />
          <T
            style={serif(38, 500, C.ink, {
              letterSpacing: em(38, -0.02),
              lineHeight: 42,
              marginTop: 14,
            })}
          >
            {stopped ? 'Timer stopped' : 'Time’s up'}
          </T>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              marginTop: 4,
            }}
          >
            <T
              accessibilityLabel={over + ' seconds past zero'}
              style={serif(30, 600, stopped ? C.ink3 : C.terra, {
                fontVariant: ['tabular-nums'],
                letterSpacing: em(30, -0.01),
              })}
            >
              {'−' + clock(over)}
            </T>
            <T style={sans(13, 600, C.ink3)}>
              {stopped ? 'when stopped' : 'past zero'}
            </T>
          </View>
        </View>

        <View
          style={{
            marginTop: 22,
            maxHeight: 230,
            flexShrink: 1,
            backgroundColor: C.surface2,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 18 }}
            showsVerticalScrollIndicator={false}
          >
            <T
              style={sans(11, 700, C.terra, {
                letterSpacing: em(11, 0.08),
                textTransform: 'uppercase',
              })}
            >
              {stepLabel}
            </T>
            <T
              style={serif(23, 500, C.ink, {
                lineHeight: 27,
                letterSpacing: em(23, -0.01),
                marginTop: 4,
              })}
            >
              {title}
            </T>
            {st?.d ? (
              <T
                style={sans(15, 400, C.ink2, { lineHeight: 23, marginTop: 8 })}
              >
                {st.d}
              </T>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <View style={{ gap: 10, paddingTop: 16 }}>
        {stopped ? null : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <BigBtn
              grow
              label={snoozeLabel}
              bg={C.terraWash2}
              col={C.terra}
              border={C.terraSoft}
              onPress={() => key && useCook.getState().snooze(key)}
            />
            <BigBtn
              grow
              label="Stop"
              a11y="Stop timer"
              bg={C.terra}
              col={C.white}
              onPress={stop}
            />
          </View>
        )}
        <BigBtn
          label="Go to step"
          icon="arrow_forward"
          bg={C.green}
          col={C.white}
          onPress={goStep}
        />
        {stopped ? (
          <BigBtn label="Close" bg={C.surface2} col={C.ink} onPress={close} />
        ) : null}
      </View>
    </Animated.View>
  );
}

function BigBtn({
  label,
  a11y,
  icon,
  bg,
  col,
  border,
  grow,
  onPress,
}: {
  label: string;
  a11y?: string;
  icon?: string;
  bg: string;
  col: string;
  border?: string;
  /** Share a row with another button; otherwise full width. */
  grow?: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={a11y ?? label}
      scale={0.96}
      easing={CSS_EASE}
      style={{
        ...(grow ? { flex: 1 } : {}),
        height: 62,
        borderRadius: 99,
        borderWidth: border ? 1.5 : 0,
        borderColor: border,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <T numberOfLines={1} style={sans(17, 700, col)}>
        {label}
      </T>
      {icon ? <Glyph name={icon} size={22} color={col} /> : null}
    </Press>
  );
}

/**
 * Alarm clock drawing. While ringing it rocks on its feet and a soft halo
 * flashes behind it; with reduced motion only the halo shows. Grey once stopped.
 */
function RingingClock({ ringing }: { ringing: boolean }) {
  const { reduced } = useMotion();
  const flash = useFlash(ringing);
  const rock = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(rock);
    rock.value = withTiming(0, { duration: 120 });
    if (!ringing || reduced) return;
    const swing = (to: number) => withTiming(to, { duration: 70 });
    rock.value = withRepeat(
      withSequence(
        swing(1),
        swing(-1),
        swing(1),
        swing(-1),
        swing(1),
        swing(-1),
        swing(0),
        withDelay(700, withTiming(0, { duration: 1 })),
      ),
      -1,
    );
    return () => cancelAnimation(rock);
  }, [ringing, reduced, rock]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * flash.value,
    transform: [{ scale: 0.92 + 0.14 * flash.value }],
  }));
  const body = useAnimatedStyle(() => ({
    transform: [{ rotate: rock.value * 9 + 'deg' }],
  }));
  const ink = ringing ? C.terra : C.lineStrong;
  const deep = ringing ? C.terraInk : C.ink3;

  return (
    <View
      style={{
        width: 168,
        height: 168,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 168,
            height: 168,
            borderRadius: 84,
            backgroundColor: ringing ? C.terraSoft : C.surface3,
          },
          halo,
        ]}
      />
      <Animated.View style={body}>
        <Svg width={124} height={124} viewBox="0 0 120 120">
          <Path d="M14 40 A26 26 0 0 1 44 12 Z" fill={ink} />
          <Path d="M106 40 A26 26 0 0 0 76 12 Z" fill={ink} />
          <Line
            x1={36}
            y1={96}
            x2={26}
            y2={110}
            stroke={deep}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <Line
            x1={84}
            y1={96}
            x2={94}
            y2={110}
            stroke={deep}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <Circle cx={60} cy={64} r={42} fill={ink} />
          <Circle cx={60} cy={64} r={33} fill={C.white} />
          <Line
            x1={60}
            y1={64}
            x2={60}
            y2={42}
            stroke={ink}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Line
            x1={60}
            y1={64}
            x2={75}
            y2={72}
            stroke={deep}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Circle cx={60} cy={64} r={5} fill={deep} />
        </Svg>
      </Animated.View>
    </View>
  );
}
