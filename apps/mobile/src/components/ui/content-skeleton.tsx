import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Skeleton } from '@/components/ui/skeleton';
import { enterContent, useReducedMotion } from '@/lib/motion';

export type ContentSkeletonShape =
  'cards' | 'grid' | 'detail' | 'list' | 'nutrition' | 'preview' | 'timeline';

type ContentSkeletonProps = {
  shape: ContentSkeletonShape;
  testID?: string;
};

export function ContentSkeleton({ shape, testID }: ContentSkeletonProps) {
  const id = testID ?? `content-skeleton-${shape}`;

  if (shape === 'cards') {
    return (
      <View testID={id} accessibilityLabel="Loading recipes" className="gap-3">
        <Skeleton height={180} radius={16} />
      </View>
    );
  }

  if (shape === 'grid') {
    return (
      <View testID={id} accessibilityLabel="Loading recipes" className="gap-3">
        <Skeleton height={168} radius={16} />
        <Skeleton height={168} radius={16} />
      </View>
    );
  }

  if (shape === 'detail') {
    return (
      <View testID={id} accessibilityLabel="Loading recipe" className="gap-4">
        <Skeleton height={220} radius={16} />
        <Skeleton height={28} radius={10} />
        <Skeleton height={58} radius={17} />
      </View>
    );
  }

  if (shape === 'list') {
    return (
      <View testID={id} accessibilityLabel="Loading list" className="gap-3">
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
      </View>
    );
  }

  if (shape === 'nutrition') {
    return (
      <View
        testID={id}
        accessibilityLabel="Calculating nutrition"
        className="mt-3 gap-2"
      >
        <Skeleton height={36} radius={12} />
        <Skeleton height={56} radius={12} />
        <Skeleton height={16} radius={8} />
      </View>
    );
  }

  if (shape === 'timeline') {
    return (
      <View
        testID={id}
        accessibilityLabel="Loading revision history"
        className="gap-3"
      >
        <View className="flex-row gap-3">
          <Skeleton height={12} width={12} radius={6} />
          <View className="flex-1">
            <Skeleton height={88} radius={18} />
          </View>
        </View>
        <View className="flex-row gap-3">
          <Skeleton height={12} width={12} radius={6} />
          <View className="flex-1">
            <Skeleton height={88} radius={18} />
          </View>
        </View>
        <View className="flex-row gap-3">
          <Skeleton height={12} width={12} radius={6} />
          <View className="flex-1">
            <Skeleton height={88} radius={18} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View testID={id} accessibilityLabel="Loading preview" className="gap-2">
      <Skeleton height={14} width="40%" radius={8} />
      <Skeleton height={16} width="80%" radius={8} />
    </View>
  );
}

export function SkeletonToContent({
  ready,
  skeleton,
  children,
  testID,
}: {
  ready: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  if (!ready) {
    return skeleton;
  }

  return (
    <Animated.View testID={testID} entering={enterContent(reduced)}>
      {children}
    </Animated.View>
  );
}
