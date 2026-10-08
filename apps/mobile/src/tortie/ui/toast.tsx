import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useFrame } from '@/tortie/frame';
import { useNav } from '@/tortie/nav-store';
import { C, EASE, SH } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { sans, T } from '@/tortie/ui/text';

/** Top toast: translateY −90 → 0 (520ms EASE), opacity 300ms. Visible 2400ms. */
export function ToastView() {
  const f = useFrame();
  const msg = useNav((s) => s.toast);
  const on = useNav((s) => s.toastOn);
  const a = useAnimatedStyle(() => ({
    opacity: withTiming(on ? 1 : 0, { duration: 300 }),
    transform: [
      { translateY: withTiming(on ? 0 : -90, { duration: 520, easing: EASE }) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: f.status + 2,
          left: 0,
          right: 0,
          zIndex: 70,
          alignItems: 'center',
        },
        a,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: C.ink,
          paddingVertical: 11,
          paddingHorizontal: 18,
          borderRadius: 99,
          boxShadow: SH.toast,
          maxWidth: '92%',
        }}
      >
        <Glyph name="check_circle" size={19} color={C.greenSoft2} fill />
        <T numberOfLines={1} style={[sans(14, 600, C.bg), { flexShrink: 1 }]}>
          {msg}
        </T>
      </View>
    </Animated.View>
  );
}
