import { View } from 'react-native';

import {
  importErrorCopy,
  type ImportErrorAction,
  type ImportErrorGroup,
} from '@/features/extraction/error-groups';
import { C, CSS_EASE } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';
import { useCountdown } from '@/tortie/ui/use-countdown';

/** Icon tile for an error group: terracotta, or amber when the source is busy. */
export function ErrorTile({
  icon,
  warn,
  size = 56,
}: {
  icon: string;
  warn: boolean;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: warn ? C.amberWash : C.terraWash2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={size * 0.5} color={warn ? C.amber : C.terra} />
    </View>
  );
}

/**
 * Import error inside the Add sheet: icon, message, sub-line and two actions.
 * A rate-limited "Try again" stays locked and counts down until `retryAt`.
 */
export function ImportErrorCard({
  group,
  source,
  retryAt,
  onAction,
}: {
  group: ImportErrorGroup;
  /** Platform name for the "TikTok links aren't supported" line. */
  source?: string;
  retryAt?: number;
  onAction: (action: ImportErrorAction) => void;
}) {
  const copy = importErrorCopy(group, source);
  const left = useCountdown(group === 'rate_limited' ? retryAt : undefined);
  const locked = copy.primary.action === 'retry' && left > 0;
  const primary = locked
    ? `${copy.primary.label} in ${left}s`
    : copy.primary.label;
  return (
    <View style={{ marginTop: 22, alignItems: 'center' }}>
      <ErrorTile icon={copy.icon} warn={copy.warn} size={64} />
      <T
        style={[
          serif(21, 500),
          { marginTop: 16, textAlign: 'center', letterSpacing: em(21, -0.01) },
        ]}
      >
        {copy.message}
      </T>
      <T
        style={[
          sans(14, 400, C.ink2),
          { marginTop: 6, textAlign: 'center', paddingHorizontal: 8 },
        ]}
      >
        {copy.sub}
      </T>
      <Press
        onPress={() => onAction(copy.primary.action)}
        disabled={locked}
        scale={0.97}
        easing={CSS_EASE}
        accessibilityLabel={primary}
        accessibilityState={{ disabled: locked }}
        style={{
          alignSelf: 'stretch',
          height: 54,
          marginTop: 22,
          borderRadius: 99,
          backgroundColor: locked ? C.surface3 : C.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={sans(15, 700, locked ? C.ink3 : C.bg)}>{primary}</T>
      </Press>
      <Press
        onPress={() => onAction(copy.secondary.action)}
        scale={0.97}
        easing={CSS_EASE}
        style={{
          alignSelf: 'stretch',
          height: 50,
          marginTop: 10,
          borderRadius: 99,
          borderWidth: 1.5,
          borderColor: C.line,
          backgroundColor: C.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={sans(15, 600)}>{copy.secondary.label}</T>
      </Press>
    </View>
  );
}
