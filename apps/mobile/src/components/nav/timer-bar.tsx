import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formatTimer } from '@/features/cook/parse-hint';
import { useBreathe } from '@/lib/motion';
import { useCookStore } from '@/stores/cook-store';
import { colors, fonts, shadows } from '@/theme/tokens';

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
      className="mx-3.5 mb-2 flex-row items-center gap-2.5 rounded-card border border-crust bg-bg px-3 py-2.5"
      style={shadows.float}
    >
      <Animated.View
        className="h-2 w-2 rounded-full"
        style={[breathe, { backgroundColor: colors.paprika }]}
      />
      <Text
        className="flex-1 text-sm"
        style={{ fontFamily: fonts.medium, color: colors.espresso }}
      >
        {timer.label} timer
      </Text>
      <Text
        className="text-[15px]"
        style={{ fontFamily: fonts.bold, color: colors.espresso }}
      >
        {formatTimer(timer.remainingSec)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={timer.running ? 'Pause timer' : 'Resume timer'}
        onPress={toggleTimer}
        className="h-11 min-w-11 items-center justify-center rounded-cta px-3"
        style={{ borderWidth: 1, borderColor: colors.espresso }}
      >
        <Text
          className="text-xs"
          style={{ fontFamily: fonts.medium, color: colors.espresso }}
        >
          {timer.running ? 'Pause' : 'Resume'}
        </Text>
      </Pressable>
    </View>
  );
}
