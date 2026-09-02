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
import { hapticLight } from '@/lib/haptics';
import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, typeface } from '@/theme/tokens';

const ICON_SIZE = 22;

function TabLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <Text
      style={{
        ...typeface('regular'),
        fontSize: 12,
        letterSpacing: -0.12,
        lineHeight: 12,
        color: active ? colors.onDark : colors.bodyMuted,
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
      className="items-center justify-center"
      style={style}
    >
      {children}
      {badge ? (
        <View
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colors.primary }}
        />
      ) : null}
    </Animated.View>
  );
}

export function MiseTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const inboxCount = Object.keys(
    useKitchenStore((state) => state.inboxStatus),
  ).length;
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
      className="flex-row items-center px-2.5"
      style={{
        backgroundColor: colors.surfaceBlack,
        minHeight: 44,
        paddingTop: 4,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Home"
        accessibilityState={{ selected: home }}
        onPress={() => go('/')}
        className="min-h-11 flex-1 items-center justify-center gap-0.5 py-1"
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
        className="min-h-11 flex-1 items-center justify-center gap-0.5 py-1"
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
        className="h-11 min-h-11 flex-1 items-center justify-center"
      >
        <View className="h-11 w-11 items-center justify-center">
          <CaptureTomato size={44} />
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
        className="min-h-11 flex-1 items-center justify-center gap-0.5 py-1"
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
        className="min-h-11 flex-1 items-center justify-center gap-0.5 py-1"
      >
        <AnimatedTabIcon active={you}>
          <YouFoodIcon size={ICON_SIZE} />
        </AnimatedTabIcon>
        <TabLabel label="You" active={you} />
      </Pressable>
    </View>
  );
}
