import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { duration, useReducedMotion } from '@/lib/motion';
import { colors, fonts, radii, shadows } from '@/theme/tokens';

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
      className="absolute left-4 right-4 z-50 flex-row items-center gap-[11px] px-4 py-3.5"
      style={{
        bottom: bottomOffset,
        backgroundColor: colors.cream,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.crust,
        ...shadows.float,
      }}
    >
      <View
        className="h-[26px] w-[26px] items-center justify-center rounded-[9px]"
        style={{ backgroundColor: colors.paprika }}
      >
        <Text className="text-[13px]" style={{ color: colors.onPrimary }}>
          {toast.glyph}
        </Text>
      </View>
      <Text
        className="flex-1 text-sm leading-[1.3]"
        style={{ fontFamily: fonts.medium, color: colors.espresso }}
      >
        {toast.text}
      </Text>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toast.action}
          onPress={toast.onAction}
          className="h-[34px] min-h-11 justify-center rounded-cta px-3"
          style={{ borderWidth: 1, borderColor: colors.espresso }}
        >
          <Text
            className="text-xs"
            style={{ fontFamily: fonts.medium, color: colors.espresso }}
          >
            {toast.action}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
