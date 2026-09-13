import { type Href, usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';

import {
  DiscoverCompassIcon,
  GroceriesBasketIcon,
  MealPlanCalendarIcon,
  RecipesBookmarkIcon,
} from '@/components/icons/recime-tab-icons';
import { Text } from '@/components/ui/text';
import { hapticLight } from '@/lib/haptics';
import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const ICON_SIZE = 26;
const PLUS_SIZE = 56;

type TabHref = '/' | '/plan' | '/groceries' | '/discover';

function TabLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <Text
      style={{
        fontFamily: active ? fonts.manrope600 : fonts.manrope500,
        fontSize: 11,
        letterSpacing: 0.02,
        color: active ? colors.espresso : colors.tabInactive,
      }}
    >
      {label}
    </Text>
  );
}

function AnimatedTabIcon({
  active,
  children,
}: {
  active: boolean;
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
    scale.value = withTiming(active ? 1 : 0.84, {
      duration: duration.fast,
      easing: reanimatedEasing,
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
        { backgroundColor: active ? colors.paper : 'transparent' },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function MiseTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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

  const go = (href: TabHref) => {
    hapticLight().catch(() => undefined);
    router.push(href as Href);
  };

  const recipes = pathname === '/' || pathname === '/index';
  const plan = pathname.startsWith('/plan');
  const groceries =
    pathname.startsWith('/groceries') ||
    pathname.startsWith('/pantry') ||
    pathname.startsWith('/shop');
  const discover = pathname.startsWith('/discover');

  return (
    <View
      className="flex-row items-center px-2.5 pt-1.5"
      style={{
        backgroundColor: colors.page,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.ctaDisabled,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Recipes"
        accessibilityState={{ selected: recipes }}
        onPress={() => go('/')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={recipes}>
          <RecipesBookmarkIcon size={ICON_SIZE} active={recipes} />
        </AnimatedTabIcon>
        <TabLabel label="Recipes" active={recipes} />
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Meal Plan"
        accessibilityState={{ selected: plan }}
        onPress={() => go('/plan')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={plan}>
          <MealPlanCalendarIcon size={ICON_SIZE} active={plan} />
        </AnimatedTabIcon>
        <TabLabel label="Meal Plan" active={plan} />
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
        <View
          className="items-center justify-center"
          style={{
            width: PLUS_SIZE,
            height: PLUS_SIZE,
            borderRadius: PLUS_SIZE / 2,
            backgroundColor: colors.paprika,
          }}
        >
          <Animated.View
            className="items-center justify-center"
            style={plusStyle}
          >
            <Plus size={28} color={colors.onPrimary} strokeWidth={2.4} />
          </Animated.View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Groceries"
        accessibilityState={{ selected: groceries }}
        onPress={() => go('/groceries')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={groceries}>
          <GroceriesBasketIcon size={ICON_SIZE} active={groceries} />
        </AnimatedTabIcon>
        <TabLabel label="Groceries" active={groceries} />
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Discover"
        accessibilityState={{ selected: discover }}
        onPress={() => go('/discover')}
        className="h-[62px] min-h-11 flex-1 items-center justify-center gap-0.5"
      >
        <AnimatedTabIcon active={discover}>
          <DiscoverCompassIcon size={ICON_SIZE} active={discover} />
        </AnimatedTabIcon>
        <TabLabel label="Discover" active={discover} />
      </Pressable>
    </View>
  );
}
