import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { C, CSS_EASE, F, SH } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

type Tone = 'green' | 'terra';

const TONE: Record<
  Tone,
  { solid: string; ink: string; wash: string; soft: string; cta: string }
> = {
  green: {
    solid: C.green,
    ink: C.bg,
    wash: C.greenWash,
    soft: C.greenSoft,
    cta: SH.greenCta,
  },
  terra: {
    solid: C.terra,
    ink: C.white,
    wash: C.terraWash,
    soft: C.terraSoft,
    cta: SH.terraCta,
  },
};

/**
 * Three fanned tiles: a solid centre tile flanked by a white card (left) and
 * a washed card (right), tilted ±9°. Every empty page uses this shape with
 * its own icons, so they read as one family.
 */
export function EmptyArt({
  icons: [left, main, right],
  tone = 'green',
  scale = 1,
}: {
  /** [left, centre, right] Material Symbols names. */
  icons: readonly [string, string, string];
  tone?: Tone;
  scale?: number;
}) {
  const t = TONE[tone];
  const other = TONE[tone === 'green' ? 'terra' : 'green'];
  const s = (n: number) => Math.round(n * scale);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: s(108),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: s(72),
          height: s(84),
          borderRadius: s(20),
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-9deg' }, { translateX: s(8) }],
          zIndex: 0,
          boxShadow: SH.cardSubtle,
        }}
      >
        <Glyph name={left} size={s(28)} color={t.solid} />
      </View>
      <View
        style={{
          width: s(80),
          height: s(94),
          borderRadius: s(22),
          backgroundColor: t.solid,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: -s(16),
          zIndex: 1,
          boxShadow: t.cta,
        }}
      >
        <Glyph name={main} size={s(34)} color={t.ink} fill />
      </View>
      <View
        style={{
          width: s(72),
          height: s(84),
          borderRadius: s(20),
          backgroundColor: other.wash,
          borderWidth: 1,
          borderColor: other.soft,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '9deg' }, { translateX: -s(8) }],
          zIndex: 0,
        }}
      >
        <Glyph name={right} size={s(28)} color={other.solid} />
      </View>
    </View>
  );
}

export type EmptyAction = {
  label: string;
  icon?: string;
  onPress: () => void;
};

type EmptyStateProps = {
  /** Fanned-tile art; `compact` shows only the centre icon in a circle. */
  icons: readonly [string, string, string];
  tone?: Tone;
  /** Small italic line above the title. */
  kicker?: string;
  title: string;
  body?: string;
  action?: EmptyAction;
  secondary?: EmptyAction;
  /**
   * `card`: white rounded card (a page with nothing else on it).
   * `wash`: tinted card (a nudge among other content).
   * `plain`: no container (inside a sheet or an existing card).
   */
  variant?: 'card' | 'wash' | 'plain';
  /** Smaller, for sections and sheets. */
  compact?: boolean;
  /** Extra content under the actions (chips, tips). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Shared empty page: art, title, one line of why, and the way forward. */
export function EmptyState({
  icons,
  tone = 'green',
  kicker,
  title,
  body,
  action,
  secondary,
  variant = 'card',
  compact = false,
  children,
  style,
}: EmptyStateProps) {
  const t = TONE[tone];
  const box: ViewStyle =
    variant === 'card'
      ? {
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: compact ? 22 : 28,
        }
      : variant === 'wash'
        ? {
            backgroundColor: t.wash,
            borderWidth: 1,
            borderColor: t.soft,
            borderRadius: compact ? 22 : 28,
          }
        : {};
  return (
    <View
      style={[
        box,
        {
          alignItems: 'center',
          paddingTop: compact ? 22 : 30,
          paddingHorizontal: 22,
          paddingBottom: compact ? 18 : 24,
        },
        style,
      ]}
    >
      {compact ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: variant === 'wash' ? C.white : t.wash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name={icons[1]} size={26} color={t.solid} />
        </View>
      ) : (
        <EmptyArt icons={icons} tone={tone} />
      )}
      {kicker ? (
        <T
          style={{
            fontFamily: F.serif400i,
            fontSize: 16,
            lineHeight: 23,
            color: tone === 'green' ? C.greenMid : C.terra,
            marginTop: 18,
          }}
        >
          {kicker}
        </T>
      ) : null}
      <T
        accessibilityRole="header"
        style={[
          serif(compact ? 21 : 27, 500),
          {
            letterSpacing: em(compact ? 21 : 27, -0.015),
            marginTop: kicker ? 4 : compact ? 12 : 18,
            textAlign: 'center',
          },
        ]}
      >
        {title}
      </T>
      {body ? (
        <T
          style={[
            sans(compact ? 13 : 14, 400, C.ink2),
            {
              lineHeight: compact ? 19 : 21,
              marginTop: compact ? 4 : 8,
              maxWidth: 290,
              textAlign: 'center',
            },
          ]}
        >
          {body}
        </T>
      ) : null}
      {action ? (
        <Press
          onPress={action.onPress}
          scale={0.96}
          easing={CSS_EASE}
          style={{
            marginTop: compact ? 16 : 22,
            height: compact ? 42 : 48,
            paddingHorizontal: compact ? 18 : 22,
            borderRadius: 99,
            backgroundColor: t.solid,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            boxShadow: t.cta,
          }}
        >
          {action.icon ? (
            <Glyph name={action.icon} size={compact ? 18 : 20} color={t.ink} />
          ) : null}
          <T style={sans(compact ? 13 : 14, 700, t.ink)}>{action.label}</T>
        </Press>
      ) : null}
      {secondary ? (
        <Press
          onPress={secondary.onPress}
          scale={0.96}
          easing={CSS_EASE}
          style={{
            marginTop: action ? 4 : compact ? 12 : 18,
            height: 40,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {secondary.icon ? (
            <Glyph name={secondary.icon} size={18} color={t.solid} />
          ) : null}
          <T style={sans(14, 600, t.solid)}>{secondary.label}</T>
        </Press>
      ) : null}
      {children}
    </View>
  );
}
