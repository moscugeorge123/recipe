import type { ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppImage } from '@/components/ui/image';
import { Text } from '@/components/ui/text';
import { productImageShadow } from '@/theme/tokens';

type PhotoStandInProps = {
  colors: [string, string];
  height: number;
  radius?: number;
  uri?: string | null;
  label?: string;
  children?: ReactNode;
  className?: string;
};

export function PhotoStandIn({
  colors,
  height,
  radius = 8,
  uri,
  label,
  children,
  className,
}: PhotoStandInProps) {
  const lift = radius > 0;

  return (
    <View style={lift ? productImageShadow : undefined}>
      <View
        className={`overflow-hidden ${className ?? ''}`}
        style={{ height, borderRadius: radius }}
      >
        {uri ? (
          <AppImage
            source={{ uri }}
            className="absolute inset-0"
            style={{ width: '100%', height }}
            contentFit="cover"
            accessibilityLabel={label ?? 'Recipe photo'}
          />
        ) : (
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        )}
        {label && !uri ? (
          <View className="absolute bottom-2 right-2.5">
            <Text
              variant="mono"
              className="text-[8.5px] tracking-[-0.08px]"
              style={{ color: 'rgba(29,29,31,0.42)' }}
            >
              {label}
            </Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}
