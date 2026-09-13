import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { MiseTabBar } from '@/components/nav/tab-bar';
import { TimerBar } from '@/components/nav/timer-bar';
import { useKeyboardBottomInset } from '@/lib/keyboard';
import { stackPushAnimation, useReducedMotion } from '@/lib/motion';

export default function TabsLayout() {
  const keyboard = useKeyboardBottomInset();
  const keyboardOpen = keyboard.height > 0;
  const pageAnimation = stackPushAnimation(useReducedMotion());

  return (
    <View className="flex-1 bg-bg">
      <Tabs
        tabBar={() =>
          keyboardOpen ? null : (
            <View>
              <TimerBar />
              <MiseTabBar />
            </View>
          )
        }
        screenOptions={{ headerShown: false, animation: pageAnimation }}
      >
        <Tabs.Screen name="index" options={{ title: 'Recipes' }} />
        <Tabs.Screen name="plan" options={{ title: 'Meal Plan' }} />
        <Tabs.Screen name="groceries" options={{ title: 'Groceries' }} />
        <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
        <Tabs.Screen name="kitchen" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="you" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
