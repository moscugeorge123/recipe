import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useFrame } from '@/tortie/frame';
import { useNav, type TabKey } from '@/tortie/nav-store';
import { C, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph, Icon } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { sans, T } from '@/tortie/ui/text';

const LEFT: [TabKey, string, string][] = [
  ['today', 'Today', 'home'],
  ['cookbook', 'Cookbook', 'menu_book'],
];
const RIGHT: [TabKey, string, string][] = [
  ['plan', 'Plan', 'calendar_month'],
  ['groceries', 'Groceries', 'shopping_basket'],
];
const IND: Record<TabKey, number> = {
  today: 0,
  cookbook: 1,
  plan: 3,
  groceries: 4,
};

/**
 * Solid bar with a hairline top border, 5-column grid. Indicator pill 60×32 slides (`left`, 460ms EASE)
 * to index × 20% + 10%. Centre + button presses to scale .88 rotate 90°.
 */
export function TabBar({
  onPlus,
  groceriesLeft,
}: {
  onPlus: () => void;
  groceriesLeft: number;
}) {
  const f = useFrame();
  const tab = useNav((s) => s.tab);
  const goTab = useNav((s) => s.goTab);
  const [w, setW] = useState(0);
  const col = (w - 20) / 5;
  const ind = useAnimatedStyle(() => ({
    transform: [{ translateX: tw(10 + col * IND[tab] + col / 2 - 30, 460) }],
  }));

  const item = ([k, label, icon]: [TabKey, string, string]) => (
    <TabItem
      key={k}
      label={label}
      icon={icon}
      active={tab === k}
      onPress={() => goTab(k)}
      badge={k === 'groceries' && groceriesLeft > 0 ? groceriesLeft : 0}
    />
  );

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        height: f.tabBarH,
        backgroundColor: C.bg,
        borderTopWidth: 1,
        borderTopColor: C.line,
      }}
    >
      {w > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 8,
              left: 0,
              width: 60,
              height: 32,
              borderRadius: 99,
              backgroundColor: C.greenSoft,
            },
            ind,
          ]}
        />
      ) : null}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingBottom: f.tabBarPad,
        }}
      >
        {LEFT.map(item)}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Press
            onPress={onPlus}
            scale={0.88}
            rotate={90}
            ms={260}
            easing={SPRING}
            accessibilityLabel="Add a recipe"
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: C.terra,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="add" size={28} color={C.bg} />
          </Press>
        </View>
        {RIGHT.map(item)}
      </View>
    </View>
  );
}

function TabItem({
  label,
  icon,
  active,
  onPress,
  badge,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  badge: number;
}) {
  const col = useAnimatedStyle(() => ({
    color: tw(active ? '#32533C' : C.ink2, 300),
  }));
  return (
    <Press
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      <View>
        <Icon
          name={icon}
          size={24}
          color={active ? '#32533C' : C.ink2}
          fill={active}
        />
        {badge > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: 9,
              backgroundColor: C.terra,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(10, 700, C.bg)}>{badge}</T>
          </View>
        ) : null}
      </View>
      <Animated.Text allowFontScaling={false} style={[sans(11, 600), col]}>
        {label}
      </Animated.Text>
    </Press>
  );
}
