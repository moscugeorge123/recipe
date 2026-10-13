import { BlurView } from 'expo-blur';
import { View } from 'react-native';

import { fmtT } from '@/tortie/lib/fmt';
import { Glyph } from '@/tortie/ui/icon';
import { C } from '@/tortie/theme';
import { sans, T } from '@/tortie/ui/text';

/** Frosted duration pill pinned bottom-left, 8px in, over a card photo. Hidden when the time is unknown. */
export function TimeChip({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 8,
        bottom: 8,
        height: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingLeft: 7,
        paddingRight: 9,
        borderRadius: 99,
        overflow: 'hidden',
      }}
    >
      <BlurView
        intensity={12}
        tint="dark"
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(25,28,25,.62)',
        }}
      />
      <Glyph name="schedule" size={14} color="#f8faf5" />
      <T style={sans(11, 700, '#f8faf5')}>{fmtT(minutes)}</T>
    </View>
  );
}

/** Green "by …" line under a card title. */
export function Byline({ text }: { text: string }) {
  return (
    <T numberOfLines={1} style={sans(12, 600, C.green, { marginTop: 2 })}>
      {text}
    </T>
  );
}
