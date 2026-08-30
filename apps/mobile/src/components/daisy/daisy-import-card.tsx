import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { daisy } from '@/components/daisy/colors';
import type { DaisyPhase } from '@/components/daisy/phase';

const fly = Easing.bezier(0.22, 1, 0.36, 1);

type DaisyImportCardProps = {
  phase: DaisyPhase;
  reducedMotion: boolean;
};

export function DaisyImportCard({
  phase,
  reducedMotion,
}: DaisyImportCardProps) {
  const shown = phase === 'importing';
  const progress = useSharedValue(shown && reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!shown) {
      progress.value = 0;
      return;
    }
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 800, easing: fly });
  }, [progress, reducedMotion, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 1, 1]),
    transform: [
      { translateX: (1 - progress.value) * 70 },
      { translateY: (1 - progress.value) * -90 },
      { rotate: `${(1 - progress.value) * 10}deg` },
      { scale: 0.6 + progress.value * 0.4 },
    ],
  }));

  if (!shown) {
    return null;
  }

  return (
    <View style={{ position: 'absolute', right: '10%', top: 4 }}>
      <Animated.View
        testID="daisy-import-card"
        style={[
          style,
          {
            width: 106,
            padding: 10,
            borderRadius: 14,
            backgroundColor: daisy.chip,
            shadowColor: daisy.ink,
            shadowOpacity: 0.14,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 10 },
            elevation: 4,
          },
        ]}
      >
        <View
          style={{
            height: 42,
            borderRadius: 9,
            backgroundColor: daisy.importThumbA,
            marginBottom: 8,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: daisy.importThumbB,
              opacity: 0.45,
            }}
          />
        </View>
        <View
          style={{
            height: 6,
            width: '80%',
            borderRadius: 3,
            backgroundColor: daisy.clipboardLine,
            marginBottom: 5,
          }}
        />
        <View
          style={{
            height: 6,
            width: '55%',
            borderRadius: 3,
            backgroundColor: daisy.clipboardLineSoft,
          }}
        />
      </Animated.View>
    </View>
  );
}
