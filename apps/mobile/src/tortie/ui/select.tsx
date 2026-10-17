import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';

import { C } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { sans, T } from '@/tortie/ui/text';

export type SelectOption<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  /** Material icon shown at the start of the row. */
  icon: string;
  label: string;
  sub?: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
};

/**
 * A one-line setting that expands in place into a scrollable radio list.
 * Closed, it is always one row tall however many options exist. The Android
 * back button closes an open list before it does anything else.
 */
export function Select<V extends string>({
  icon,
  label,
  sub,
  value,
  options,
  onChange,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  return (
    <View>
      <Press
        onPress={() => setOpen((o) => !o)}
        scale={0.99}
        bg={C.white}
        pressedBg={C.surface2}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: current }}
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 12,
        }}
      >
        <Glyph name={icon} size={22} color={C.green} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(15, 600)}>{label}</T>
          {sub ? (
            <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>{sub}</T>
          ) : null}
        </View>
        <T
          numberOfLines={1}
          style={[sans(13, 700, C.green), { maxWidth: 110 }]}
        >
          {current}
        </T>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Glyph name="expand_more" size={20} color={C.ink3} />
        </View>
      </Press>
      {open ? (
        <ScrollView
          nestedScrollEnabled
          style={{ maxHeight: 232, marginBottom: 10 }}
          accessibilityRole="radiogroup"
        >
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Press
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                scale={0.99}
                bg={on ? C.greenWash3 : 'transparent'}
                pressedBg={C.surface2}
                accessibilityRole="radio"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 44,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                }}
              >
                <T style={sans(14, on ? 700 : 500, on ? C.green : C.ink)}>
                  {o.label}
                </T>
                {on ? <Glyph name="check" size={18} color={C.green} /> : null}
              </Press>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
