import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { duration, useReducedMotion } from '@/lib/motion';
import { colors, radii, typeface } from '@/theme/tokens';

export type ToastData = {
  text: string;
  glyph: string;
  action?: string;
  onAction?: () => void;
};

type ToastProps = {
  toast: ToastData | null;
  bottomOffset?: number;
};

export function Toast({ toast, bottomOffset = 104 }: ToastProps) {
  const reduced = useReducedMotion();

  if (!toast) {
    return null;
  }

  return (
    <Animated.View
      entering={
        reduced ? undefined : FadeInDown.duration(duration.toast).springify()
      }
      exiting={reduced ? undefined : FadeOut.duration(duration.instant)}
      pointerEvents="box-none"
      className="absolute left-4 right-4 z-50 flex-row items-center gap-3 px-4 py-3.5"
      style={{
        bottom: bottomOffset,
        backgroundColor: colors.tile1,
        borderRadius: radii.lg,
      }}
    >
      <View
        className="h-[26px] w-[26px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-[13px]" style={{ color: colors.onPrimary }}>
          {toast.glyph}
        </Text>
      </View>
      <Text
        tone="inverse"
        className="flex-1 text-[14px] leading-[1.3]"
        style={typeface('regular')}
      >
        {toast.text}
      </Text>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toast.action}
          onPress={toast.onAction}
          className="h-[34px] min-h-11 justify-center rounded-full px-3"
          style={{ backgroundColor: colors.primary }}
        >
          <Text
            tone="inverse"
            className="text-[14px]"
            style={typeface('regular')}
          >
            {toast.action}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
