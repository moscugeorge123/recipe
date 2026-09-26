import { useState, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type ScrollViewProps,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useFrame } from '@/tortie/frame';
import { C, CSS_EASE, SH } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { KeyboardScroll } from '@/tortie/ui/input';

type TabScrollProps = Omit<ScrollViewProps, 'children'> & {
  /** Fixed header; receives `compact` (scrollTop > 24). */
  header: (compact: boolean) => ReactNode;
  children: ReactNode;
  scrollRef?: Ref<ScrollView>;
  onCompactChange?: (compact: boolean) => void;
};

/**
 * Tab screen scroll view: padding `58px 20px 124px`, fixed header
 * (bg #f8faf5) that compacts after 24px with the shadow
 * `0 10px 18px -12px rgba(46,49,46,.22)`.
 *
 * The header is a sibling of the scroller, not a sticky row. Sticky rows are
 * translated with the scroll offset, which leaves their tap targets behind.
 */
export function TabScroll({
  header,
  children,
  scrollRef,
  onCompactChange,
  onScroll,
  style,
  ...rest
}: TabScrollProps) {
  const f = useFrame();
  const [compact, setCompact] = useState(false);
  const shadow = useAnimatedStyle(() => ({
    opacity: tw(compact ? 1 : 0, 220, CSS_EASE),
  }));
  const handle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const c = e.nativeEvent.contentOffset.y > 24;
    if (c !== compact) {
      setCompact(c);
      onCompactChange?.(c);
    }
    onScroll?.(e);
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ zIndex: 5, backgroundColor: C.bg }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              {
                flex: 1,
                backgroundColor: C.bg,
                boxShadow: SH.header,
              },
              shadow,
            ]}
          />
        </View>
        <View
          style={{
            backgroundColor: C.bg,
            paddingTop: f.top,
            paddingHorizontal: 20,
          }}
        >
          {header(compact)}
        </View>
      </View>
      <KeyboardScroll
        {...rest}
        ref={scrollRef}
        style={[{ flex: 1 }, style]}
        showsVerticalScrollIndicator={false}
        onScroll={handle}
        contentContainerStyle={{ paddingBottom: f.tabContentBottom }}
      >
        <View style={{ paddingHorizontal: 20 }}>{children}</View>
      </KeyboardScroll>
    </View>
  );
}
