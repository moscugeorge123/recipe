import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { MiseTabBar } from '@/components/nav/tab-bar';
import { TimerBar } from '@/components/nav/timer-bar';

export default function TabsLayout() {
  return (
    <View className="flex-1 bg-bg">
      <Tabs
        tabBar={() => (
          <View>
            <TimerBar />
            <MiseTabBar />
          </View>
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
        <Tabs.Screen name="kitchen" options={{ title: 'Kitchen' }} />
        <Tabs.Screen name="you" options={{ title: 'You' }} />
      </Tabs>
    </View>
  );
}
