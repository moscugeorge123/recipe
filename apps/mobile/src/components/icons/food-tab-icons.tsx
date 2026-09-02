import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

type FoodIconProps = {
  size?: number;
  muted?: boolean;
};

const ink = colors.ink;
const blue = colors.primary;
const white = colors.onDark;
const chip = colors.steam;
const muted = colors.bodyMuted;

function Canvas({
  size,
  muted: dim,
  testID,
  children,
}: FoodIconProps & { testID: string; children: ReactNode }) {
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, opacity: dim ? 0.48 : 1 }}
    >
      {children}
    </View>
  );
}

function px(size: number, n: number, base = 22) {
  return (n / base) * size;
}

/** Round burger — home cooking. */
export function HomeFoodIcon({ size = 22, muted: dim }: FoodIconProps) {
  const s = (n: number) => px(size, n);
  return (
    <Canvas size={size} muted={dim} testID="food-tab-home">
      <View
        style={{
          position: 'absolute',
          top: s(1.6),
          left: s(2.4),
          height: s(9.2),
          width: s(17.2),
          borderTopLeftRadius: s(9),
          borderTopRightRadius: s(9),
          borderBottomLeftRadius: s(4.5),
          borderBottomRightRadius: s(4.5),
          backgroundColor: chip,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(4.2),
          left: s(6.2),
          height: s(1.5),
          width: s(1.5),
          borderRadius: s(0.8),
          backgroundColor: white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(3.4),
          left: s(10.2),
          height: s(1.4),
          width: s(1.4),
          borderRadius: s(0.7),
          backgroundColor: white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(4.6),
          left: s(14),
          height: s(1.5),
          width: s(1.5),
          borderRadius: s(0.8),
          backgroundColor: white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(9.4),
          left: s(2),
          height: s(3.2),
          width: s(18),
          borderRadius: s(1.6),
          backgroundColor: muted,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(11.6),
          left: s(3.2),
          height: s(3),
          width: s(15.6),
          borderRadius: s(1.5),
          backgroundColor: blue,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(13.8),
          left: s(2.6),
          height: s(6.4),
          width: s(16.8),
          borderTopLeftRadius: s(3.5),
          borderTopRightRadius: s(3.5),
          borderBottomLeftRadius: s(8.5),
          borderBottomRightRadius: s(8.5),
          backgroundColor: chip,
        }}
      />
    </Canvas>
  );
}

/** Lemon-wheel compass — explore flavors. */
export function ExploreFoodIcon({ size = 22, muted: dim }: FoodIconProps) {
  const s = (n: number) => px(size, n);
  return (
    <Canvas size={size} muted={dim} testID="food-tab-explore">
      <View
        style={{
          position: 'absolute',
          top: s(1),
          left: s(1),
          height: s(20),
          width: s(20),
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: s(10),
          backgroundColor: chip,
        }}
      >
        <View
          style={{
            height: s(14),
            width: s(14),
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: s(7),
            backgroundColor: white,
          }}
        >
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: s(2.4),
              borderRightWidth: s(2.4),
              borderBottomWidth: s(5.8),
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: blue,
            }}
          />
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: s(2.2),
              borderRightWidth: s(2.2),
              borderTopWidth: s(5.2),
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: ink,
            }}
          />
        </View>
      </View>
    </Canvas>
  );
}

/** Stock pot with steam — the kitchen. */
export function KitchenFoodIcon({ size = 22, muted: dim }: FoodIconProps) {
  const s = (n: number) => px(size, n);
  return (
    <Canvas size={size} muted={dim} testID="food-tab-kitchen">
      <View
        style={{
          position: 'absolute',
          top: s(0),
          left: s(6.5),
          height: s(4.2),
          width: s(1.6),
          borderRadius: s(1),
          backgroundColor: muted,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(1.2),
          left: s(10.2),
          height: s(4.2),
          width: s(1.6),
          borderRadius: s(1),
          backgroundColor: muted,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(0),
          left: s(13.8),
          height: s(4.2),
          width: s(1.6),
          borderRadius: s(1),
          backgroundColor: muted,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(3.6),
          left: s(10),
          height: s(2.4),
          width: s(2.4),
          borderRadius: s(1.2),
          backgroundColor: white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(5.2),
          left: s(3),
          height: s(2.8),
          width: s(16),
          borderRadius: s(1.4),
          backgroundColor: white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(7.6),
          left: s(4.2),
          height: s(12.4),
          width: s(13.6),
          borderBottomLeftRadius: s(3.4),
          borderBottomRightRadius: s(3.4),
          backgroundColor: chip,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(11),
          left: s(17.2),
          height: s(2.6),
          width: s(4.2),
          borderRadius: s(1.3),
          backgroundColor: white,
        }}
      />
    </Canvas>
  );
}

/** Ripe apple — you. */
export function YouFoodIcon({ size = 22, muted: dim }: FoodIconProps) {
  const s = (n: number) => px(size, n);
  return (
    <Canvas size={size} muted={dim} testID="food-tab-you">
      <View
        style={{
          position: 'absolute',
          top: s(1.2),
          left: s(11.5),
          height: s(4.2),
          width: s(7),
          transform: [{ rotate: '28deg' }],
          borderRadius: s(4),
          backgroundColor: chip,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(1.8),
          left: s(10),
          height: s(4.5),
          width: s(2),
          borderRadius: s(1),
          backgroundColor: white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(5.2),
          left: s(2.5),
          height: s(16),
          width: s(17),
          borderRadius: s(8.5),
          backgroundColor: blue,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s(8),
          left: s(6.2),
          height: s(5),
          width: s(3.6),
          borderRadius: s(2),
          backgroundColor: 'rgba(255, 255, 255, 0.55)',
        }}
      />
    </Canvas>
  );
}

/** Capture control — Action Blue circular 44×44. Plus is drawn by the tab bar. */
export function CaptureTomato({ size = 28 }: { size?: number }) {
  return (
    <View
      testID="food-tab-capture"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size / 2,
        backgroundColor: blue,
      }}
    />
  );
}
