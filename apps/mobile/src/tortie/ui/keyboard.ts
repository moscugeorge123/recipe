import { useSyncExternalStore } from 'react';
import { Dimensions, Keyboard, Platform, type ViewStyle } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { keyboardOverlayInset } from '@/lib/keyboard';
import { EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';

/**
 * `h`: px of the app frame the keyboard covers (0 when hidden or when the
 * frame itself already ends at the keyboard). `frame`: that frame's bottom.
 */
export type KeyboardState = { h: number; ms: number; frame: number };

const FALLBACK_MS = 250;
let kb: KeyboardState = { h: 0, ms: FALLBACK_MS, frame: 0 };
const subs = new Set<() => void>();
const hideSubs = new Set<() => void>();
let attached = false;
let frameBottom = 0;
let coords = { screenY: 0, height: 0, ms: FALLBACK_MS };

function publish(next: KeyboardState) {
  const changed = next.h !== kb.h || next.frame !== kb.frame;
  kb = next;
  if (changed) subs.forEach((fn) => fn());
}

function hidden() {
  hideSubs.forEach((fn) => fn());
}

function recompute() {
  const bottom =
    frameBottom > 0 ? frameBottom : Dimensions.get('window').height;
  publish({
    h: keyboardOverlayInset(
      bottom,
      coords.screenY,
      coords.height,
      Dimensions.get('screen').height,
    ),
    ms: coords.ms,
    frame: bottom,
  });
}

/** Bottom of the app frame in window coordinates. Native only; web uses visualViewport. */
export function reportAppFrame(bottom: number) {
  if (
    Platform.OS === 'web' ||
    !(bottom > 0) ||
    Math.abs(bottom - frameBottom) < 1
  ) {
    return;
  }
  frameBottom = bottom;
  if (attached) recompute();
}

function attach() {
  attached = true;
  if (Platform.OS === 'web') {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const sync = () => {
      if (!vv) return;
      const covered = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      const was = kb.h;
      publish({ h: covered < 100 ? 0 : covered, ms: FALLBACK_MS, frame: 0 });
      if (was > 0 && kb.h === 0) hidden();
    };
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    return;
  }
  const ios = Platform.OS === 'ios';
  const ms = (d: number | undefined) => (d && d > 0 ? d : FALLBACK_MS);
  const remember = (e: {
    duration?: number;
    endCoordinates: { screenY: number; height: number };
  }) => {
    coords = {
      screenY: e.endCoordinates.screenY,
      height: e.endCoordinates.height,
      ms: ms(e.duration),
    };
    recompute();
  };
  Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', remember);
  Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
    coords = { screenY: 0, height: 0, ms: ms(e.duration) };
    recompute();
    hidden();
  });
  Dimensions.addEventListener('change', () => {
    if (frameBottom > 0) return;
    recompute();
  });
}

function subscribe(fn: () => void) {
  if (!attached) attach();
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** Runs `fn` each time the software keyboard closes (Android back, iOS dismiss, web). */
export function onKeyboardHide(fn: () => void): () => void {
  if (!attached) attach();
  hideSubs.add(fn);
  return () => {
    hideSubs.delete(fn);
  };
}

const snapshot = () => kb;

/** Keyboard overlay on every platform (iOS, Android edge-to-edge, web visualViewport). */
export function useKeyboard(): KeyboardState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Animated `bottom` that docks an absolutely positioned view (sheet, bottom
 * bar) on top of the keyboard. `gap` is extra space above the keyboard while
 * it is open. Pass the style after the view's own `bottom`.
 */
export function useKeyboardLift(gap = 0): ViewStyle {
  const { h, ms } = useKeyboard();
  const dock = h > 0 ? h + gap : 0;
  const a = useAnimatedStyle(() => ({ bottom: tw(dock, ms, EASE) }));
  // Only for Animated views; typed as ViewStyle so it drops into style arrays.
  return a as unknown as ViewStyle;
}
