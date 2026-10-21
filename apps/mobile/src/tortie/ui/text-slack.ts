import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/**
 * Android measures Newsreader a few px narrower than it draws it (the width is
 * computed before glyph advances + tracking are applied). A shrink-wrapped or
 * centred heading then wraps its last word onto a hidden second line (Q12).
 * Giving serif text a little horizontal slack makes the measured box wide enough.
 * Applied inside the shared `T`, so no screen has to opt in.
 */
export const SERIF_SLACK_EM = 0.08;

export function serifSlack(
  style: StyleProp<TextStyle>,
): { paddingLeft: number; paddingRight: number } | null {
  const s = StyleSheet.flatten(style);
  if (!s || typeof s.fontFamily !== 'string') return null;
  if (!s.fontFamily.startsWith('Newsreader')) return null;
  const size = typeof s.fontSize === 'number' ? s.fontSize : 16;
  const tracking = typeof s.letterSpacing === 'number' ? s.letterSpacing : 0;
  const slack = Math.ceil(
    size * SERIF_SLACK_EM + (tracking < 0 ? -tracking * 2 : 0),
  );
  const hasPad =
    s.padding != null ||
    s.paddingHorizontal != null ||
    s.paddingLeft != null ||
    s.paddingRight != null ||
    s.paddingStart != null ||
    s.paddingEnd != null;
  if (hasPad) return null;
  return { paddingLeft: slack, paddingRight: slack };
}
