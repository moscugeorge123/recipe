import { useEffect, useState } from 'react';
import { Keyboard, Platform, type ViewStyle } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';

/**
 * Lifts a bottom sheet above the iOS keyboard (Android pans the window:
 * `softwareKeyboardLayoutMode: pan`). Pass the result in `Sheet`'s `style`.
 */
export function useKeyboardLift(): ViewStyle {
  const [kb, setKb] = useState({ h: 0, ms: 250 });
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const a = Keyboard.addListener('keyboardWillShow', (e) =>
      setKb({ h: e.endCoordinates.height, ms: e.duration || 250 }),
    );
    const b = Keyboard.addListener('keyboardWillHide', (e) =>
      setKb({ h: 0, ms: e.duration || 250 }),
    );
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  const a = useAnimatedStyle(() => ({ bottom: tw(kb.h, kb.ms, EASE) }));
  // Sheet renders `style` on its Animated.View, so an animated style is safe despite the ViewStyle type.
  return a as unknown as ViewStyle;
}
