import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formatTimer } from '@/features/cook/parse-hint';
import { useBreathe } from '@/lib/motion';
import { useCookStore } from '@/stores/cook-store';
import { colors, fonts } from '@/theme/tokens';

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
      className="mx-3.5 mb-2 flex-row items-center gap-2.5 rounded-[14px] px-3 py-2.5"
      style={{ backgroundColor: colors.espresso }}
    >
      <Animated.View
        className="h-2 w-2 rounded-full"
        style={[breathe, { backgroundColor: colors.honey }]}
      />
      <Text
        tone="inverse"
        className="flex-1 text-[13px]"
        style={{ fontFamily: fonts.manrope600 }}
      >
        {timer.label} timer
      </Text>
      <Text
        tone="inverse"
        className="text-[15px]"
        style={{ fontFamily: fonts.mono700, letterSpacing: 0.3 }}
      >
        {formatTimer(timer.remainingSec)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={timer.running ? 'Pause timer' : 'Resume timer'}
        onPress={toggleTimer}
        className="h-11 min-w-11 items-center justify-center rounded-[9px] px-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
      >
        <Text
          tone="inverse"
          className="text-[11px] tracking-[0.08em]"
          style={{ fontFamily: fonts.manrope700 }}
        >
          {timer.running ? 'Pause' : 'Resume'}
        </Text>
      </Pressable>
    </View>
  );
}
