import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useFrame } from '@/tortie/frame';
import { useNav } from '@/tortie/nav-store';
import { C, EASE, SH } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { sans, T } from '@/tortie/ui/text';
import { useT } from '@/i18n';

/**
 * Bottom toast: translateY 90 → 0 (520ms EASE), opacity 300ms. Visible 2400ms (3800ms for
 * errors). It sits above the tab bar, or above a pushed screen's bottom button, so it never
 * covers a back button or a title; up to two lines; tap to dismiss.
 *
 * The store hides it on a timer, and this view backs that up: it hides itself at the toast's
 * deadline, and again when the app returns to the foreground (timers do not run while the app
 * is backgrounded), so a toast can never stay on screen.
 */
export function ToastView() {
  const tr = useT();
  const f = useFrame();
  const msg = useNav((s) => s.toast);
  const on = useNav((s) => s.toastOn);
  const err = useNav((s) => s.toastErr);
  const action = useNav((s) => s.toastAction);
  const nonce = useNav((s) => s.toastNonce);
  const until = useNav((s) => s.toastUntil);
  // A pushed screen or full-screen layer has its own bottom button; the tab bar is covered.
  const pushed = useNav(
    (s) =>
      s.detailOpen ||
      s.prof ||
      s.imports ||
      s.shareOpen ||
      s.cookOpen ||
      s.edit ||
      s.cam ||
      s.au,
  );
  const bottom = pushed ? f.bottom + 112 : f.tabBarH + 14;

  useEffect(() => {
    if (!on) return;
    const hideIfDue = () => {
      if (Date.now() >= until) useNav.getState().toastHide();
    };
    const t = setTimeout(hideIfDue, Math.max(0, until - Date.now()) + 50);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hideIfDue();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
    // `nonce` restarts this for a replacement toast.
  }, [on, until, nonce]);
  const a = useAnimatedStyle(() => ({
    opacity: withTiming(on ? 1 : 0, { duration: 300 }),
    transform: [
      { translateY: withTiming(on ? 0 : 90, { duration: 520, easing: EASE }) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents={on ? 'box-none' : 'none'}
      style={[
        {
          position: 'absolute',
          bottom,
          left: 16,
          right: 16,
          zIndex: 70,
          alignItems: 'center',
        },
        a,
      ]}
    >
      <Press
        onPress={() => useNav.getState().toastHide()}
        scale={0.98}
        accessibilityLabel={tr('common.dismissMessage')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: C.ink,
          paddingVertical: 11,
          paddingHorizontal: 18,
          borderRadius: 22,
          boxShadow: SH.toast,
          maxWidth: '100%',
        }}
      >
        <Glyph
          name={err ? 'error' : 'check_circle'}
          size={19}
          color={err ? C.errorSoft : C.greenSoft2}
          fill
        />
        <T
          numberOfLines={2}
          style={[sans(14, 600, C.bg), { flexShrink: 1, lineHeight: 19 }]}
        >
          {msg}
        </T>
        {action ? (
          <Press
            onPress={() => {
              useNav.getState().toastHide();
              action.run();
            }}
            accessibilityLabel={action.label}
            style={{ paddingLeft: 6, justifyContent: 'center' }}
          >
            <T style={sans(14, 700, C.greenSoft2)}>{action.label}</T>
          </Press>
        ) : null}
      </Press>
    </Animated.View>
  );
}
