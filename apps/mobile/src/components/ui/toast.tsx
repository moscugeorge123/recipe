import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { enterToast, exitToast, useReducedMotion } from '@/lib/motion';
import { colors, fonts } from '@/theme/tokens';

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
      entering={enterToast(reduced)}
      exiting={exitToast(reduced)}
      pointerEvents="box-none"
      className="absolute left-4 right-4 z-50 flex-row items-center gap-[11px] rounded-[17px] px-4 py-3.5"
      style={{ bottom: bottomOffset, backgroundColor: colors.espresso }}
    >
      <View
        className="h-[26px] w-[26px] items-center justify-center rounded-[9px]"
        style={{ backgroundColor: colors.paprika }}
      >
        <Text className="text-[13px]" style={{ color: colors.espresso }}>
          {toast.glyph}
        </Text>
      </View>
      <Text
        className="flex-1 text-[14px] leading-[1.3]"
        tone="inverse"
        style={{ fontFamily: fonts.manrope600 }}
      >
        {toast.text}
      </Text>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toast.action}
          onPress={toast.onAction}
          className="h-[34px] min-h-11 justify-center rounded-[11px] px-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
        >
          <Text
            tone="inverse"
            className="text-[12.5px]"
            style={{ fontFamily: fonts.manrope700 }}
          >
            {toast.action}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
