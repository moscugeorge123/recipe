import { usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    CaptureTomato,
    ExploreFoodIcon,
    HomeFoodIcon,
    KitchenFoodIcon,
    YouFoodIcon,
} from '@/components/icons/food-tab-icons';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { hapticLight } from '@/lib/haptics';
import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const ICON_SIZE = 28;

function TabLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <Text
      style={{
        fontFamily: active ? fonts.mono700 : fonts.mono600,
        fontSize: 10.5,
        letterSpacing: 0.2,
        color: active ? colors.espresso : colors.sage,
      }}
    >
      {label}
    </Text>
  );
}

function AnimatedTabIcon({
  active,
  badge,
  children,
}: {
  active: boolean;
  badge?: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(active ? 1 : 0.84);
  const opacity = useSharedValue(active ? 1 : 0.52);

  useEffect(() => {
    if (reduced) {
      scale.value = active ? 1 : 0.84;
      opacity.value = active ? 1 : 0.52;
      return;
    }
    scale.value = withSpring(active ? 1 : 0.84, {
      damping: 16,
      stiffness: 220,
    });
    opacity.value = withTiming(active ? 1 : 0.52, {
      duration: duration.fast,
      easing: reanimatedEasing,
    });
  }, [active, opacity, reduced, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="h-11 w-11 items-center justify-center rounded-full"
      style={[
        { backgroundColor: active ? colors.paprikaSoft : 'transparent' },
        style,
      ]}
    >
      {children}
      {badge ? (
        <View className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-bg bg-primary" />
      ) : null}
    </Animated.View>
  );
}

export function MiseTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const inboxCount = Object.keys(useCatalog().inboxStatus).length;
  const openCapture = useUiStore((state) => state.openCapture);
  const closeCapture = useUiStore((state) => state.closeCapture);
  const captureOpen = useUiStore((state) => state.captureOpen);
  const plusRotate = useSharedValue(captureOpen ? 45 : 0);

  useEffect(() => {
    plusRotate.value = reduced
      ? captureOpen
        ? 45
        : 0
      : withTiming(captureOpen ? 45 : 0, {
          duration: duration.fast,
          easing: reanimatedEasing,
        });
  }, [captureOpen, plusRotate, reduced]);

  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plusRotate.value}deg` }],
  }));

  const go = (href: '/' | '/explore' | '/kitchen' | '/you') => {
    hapticLight().catch(() => undefined);
    router.push(href);
  };

  const home = pathname === '/' || pathname === '/index';
  const explore = pathname.startsWith('/explore');
  const kitchen = pathname.startsWith('/kitchen');
  const you = pathname.startsWith('/you');

  return (
    <View
      className="bg-bg/92 flex-row items-center border-t border-crust px-2.5 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Home"
        accessibilityState={{ selected: home }}
        onPress={() => go('/')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={home}>
          <HomeFoodIcon size={ICON_SIZE} />
        </AnimatedTabIcon>
        <TabLabel label="Home" active={home} />
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Explore"
        accessibilityState={{ selected: explore }}
        onPress={() => go('/explore')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={explore}>
          <ExploreFoodIcon size={ICON_SIZE} />
        </AnimatedTabIcon>
        <TabLabel label="Explore" active={explore} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={captureOpen ? 'Close capture' : 'Capture a recipe'}
        accessibilityState={{ expanded: captureOpen }}
        onPress={() => {
          hapticLight().catch(() => undefined);
          if (captureOpen) {
            closeCapture();
          } else {
            openCapture();
          }
        }}
        className="h-[62px] min-h-11 flex-1 items-center justify-center"
      >
        <View className="h-11 w-11 items-center justify-center">
          <CaptureTomato size={40} />
          <Animated.View
            className="absolute items-center justify-center"
            style={plusStyle}
          >
            <View className="absolute h-[2.4px] w-3.5 rounded-full bg-white" />
            <View className="absolute h-3.5 w-[2.4px] rounded-full bg-white" />
          </Animated.View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Kitchen"
        accessibilityState={{ selected: kitchen }}
        onPress={() => go('/kitchen')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={kitchen} badge={inboxCount > 0}>
          <KitchenFoodIcon size={ICON_SIZE} />
        </AnimatedTabIcon>
        <TabLabel label="Kitchen" active={kitchen} />
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="You"
        accessibilityState={{ selected: you }}
        onPress={() => go('/you')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={you}>
          <YouFoodIcon size={ICON_SIZE} />
        </AnimatedTabIcon>
        <TabLabel label="You" active={you} />
      </Pressable>
    </View>
  );
}
