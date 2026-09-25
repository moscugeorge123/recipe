import { useState, type ReactNode, type Ref } from 'react';
import {
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useFrame } from '@/tortie/frame';
import { C, CSS_EASE, SH } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';

type TabScrollProps = Omit<ScrollViewProps, 'children'> & {
  /** Sticky header; receives `compact` (scrollTop > 24). */
  header: (compact: boolean) => ReactNode;
  children: ReactNode;
  scrollRef?: Ref<ScrollView>;
  onCompactChange?: (compact: boolean) => void;
};

/**
 * Tab screen scroll view: padding `58px 20px 124px`, sticky header
 * (`top:-58px`, bg #f8faf5) that compacts after 24px with the shadow
 * `0 10px 18px -12px rgba(46,49,46,.22)`.
 */
export function TabScroll({
  header,
  children,
  scrollRef,
  onCompactChange,
  onScroll,
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
    <ScrollView
      ref={scrollRef}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handle}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: f.tabContentBottom }}
      {...rest}
    >
      <View style={{ zIndex: 5 }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: C.bg,
              boxShadow: SH.header,
            },
            shadow,
          ]}
        />
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
      <View style={{ paddingHorizontal: 20 }}>{children}</View>
    </ScrollView>
  );
}
