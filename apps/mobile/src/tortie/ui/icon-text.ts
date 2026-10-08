import type { TextStyle } from 'react-native';

import { F } from '@/tortie/theme';

/** Material Symbols glyph style for an `Animated.Text` whose colour transitions (`Glyph` can't animate colour). */
export const iconText = (size: number, fill = false): TextStyle => ({
  fontFamily: fill ? F.iconFill : F.icon,
  fontSize: size,
  lineHeight: size,
  width: size,
  height: size,
  textAlign: 'center',
  textAlignVertical: 'center',
  includeFontPadding: false,
});
