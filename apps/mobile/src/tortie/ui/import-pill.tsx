import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  averageProgress,
  pillLabel,
  runningJobs,
} from '@/features/extraction/import-jobs';
import { useFrame } from '@/tortie/frame';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, SH } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { sans, T } from '@/tortie/ui/text';

const RING = 30;
const STROKE = 3.5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Any full-screen layer hides the pill (the Add sheet, Imports, detail, profile, cook, editor, camera, …). */
function useLayerOpen() {
  return useNav(
    (s) =>
      s.addSheet ||
      s.imports ||
      s.detailOpen ||
      s.prof ||
      s.cookOpen ||
      s.edit ||
      s.cam ||
      s.shareOpen ||
      s.au,
  );
}

/**
 * Floating "Importing…" pill above the tab bar. Shows while any import runs
 * and no full-screen layer is open; tapping it opens Imports.
 */
export function ImportPill() {
  const f = useFrame();
  const count = useImports((s) => runningJobs(s.jobs).length);
  const avg = useImports((s) => averageProgress(s.jobs));
  const layer = useLayerOpen();
  const on = count > 0 && !layer;
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0, 280, CSS_EASE),
    transform: [{ translateY: tw(on ? 0 : 16, 420) }],
  }));
  return (
    <Animated.View
      pointerEvents={on ? 'box-none' : 'none'}
      accessibilityElementsHidden={!on}
      importantForAccessibility={on ? 'auto' : 'no-hide-descendants'}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: f.tabBarH + 12,
          zIndex: 21,
          alignItems: 'center',
        },
        a,
      ]}
    >
      <Press
        onPress={() => useNav.getState().openImports()}
        scale={0.96}
        easing={CSS_EASE}
        accessibilityLabel={`${pillLabel(count)}. Open imports`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 46,
          paddingLeft: 8,
          paddingRight: 12,
          borderRadius: 23,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          boxShadow: SH.card,
        }}
      >
        <Ring pct={avg} />
        <T style={sans(14, 700)}>{pillLabel(count)}</T>
        <Glyph name="chevron_right" size={20} color={C.ink3} />
      </Press>
    </Animated.View>
  );
}

function Ring({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <View style={{ width: RING, height: RING }}>
      <Svg
        width={RING}
        height={RING}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={C.surface3}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={C.terra}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={CIRC * (1 - p / 100)}
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: RING,
          height: RING,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name="auto_awesome" size={14} color={C.terra} fill />
      </View>
    </View>
  );
}
