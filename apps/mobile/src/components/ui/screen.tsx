import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { duration, useReducedMotion } from '@/lib/motion';

type ScreenProps = {
  children: ReactNode;
  className?: string;
  edges?: Edge[];
};

export function Screen({
  children,
  className,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const reduced = useReducedMotion();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={edges}>
      <Animated.View
        entering={
          reduced ? undefined : FadeInDown.duration(duration.fast).springify()
        }
        className={`flex-1 ${className ?? ''}`}
      >
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}
