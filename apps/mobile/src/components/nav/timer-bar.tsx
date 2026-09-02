import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formatTimer } from '@/features/cook/parse-hint';
import { useBreathe } from '@/lib/motion';
import { useCookStore } from '@/stores/cook-store';
import { colors, radii, typeface } from '@/theme/tokens';

export function TimerBar() {
  const timer = useCookStore((state) => state.timer);
  const toggleTimer = useCookStore((state) => state.toggleTimer);
  const breathe = useBreathe(!!timer?.running);

  if (!timer) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${timer.label} timer ${formatTimer(timer.remainingSec)}`}
      className="mx-3.5 mb-2 flex-row items-center gap-2.5 px-8 py-3"
      style={{
        backgroundColor: 'rgba(245, 245, 247, 0.8)',
        borderRadius: radii.lg,
        minHeight: 64,
      }}
    >
      <Animated.View
        className="h-2 w-2 rounded-full"
        style={[breathe, { backgroundColor: colors.primary }]}
      />
      <Text
        tone="default"
        className="flex-1 text-[17px]"
        style={typeface('regular')}
      >
        {timer.label} timer
      </Text>
      <Text
        tone="default"
        className="text-[17px]"
        style={{ ...typeface('semibold'), letterSpacing: -0.374 }}
      >
        {formatTimer(timer.remainingSec)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={timer.running ? 'Pause timer' : 'Resume timer'}
        onPress={toggleTimer}
        className="h-11 min-w-11 items-center justify-center rounded-full px-[22px]"
        style={{ backgroundColor: colors.primary }}
      >
        <Text
          className="text-[17px]"
          style={{ ...typeface('regular'), color: colors.onPrimary }}
        >
          {timer.running ? 'Pause' : 'Resume'}
        </Text>
      </Pressable>
    </View>
  );
}
