import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

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
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={edges}>
      <View className={`flex-1 ${className ?? ''}`}>{children}</View>
    </SafeAreaView>
  );
}
