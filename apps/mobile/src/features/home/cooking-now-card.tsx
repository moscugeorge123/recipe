import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  useActiveCook,
  useFinishCooking,
} from '@/features/cook-sessions/hooks';
import { colors, fonts } from '@/theme/tokens';

export function CookingNowCard() {
  const cooking = useActiveCook();
  const { stopAndClear } = useFinishCooking();

  if (!cooking.isVisible || !cooking.recipeId || !cooking.title) {
    return null;
  }

  const confirmStop = () => {
    Alert.alert(
      'Stop cooking?',
      'This will mark the recipe as finished and hide it from Home.',
      [
        { text: 'Keep cooking', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => {
            stopAndClear().catch(() => undefined);
          },
        },
      ],
    );
  };

  const bars = Array.from({ length: Math.max(cooking.stepCount, 1) });

  return (
    <View
      className="mx-5 mb-[26px] rounded-[20px] p-4"
      style={{ backgroundColor: colors.espresso }}
    >
      <Text
        className="text-[10.5px] tracking-[0.14em]"
        tone="accent"
        style={{ fontFamily: fonts.mono500 }}
      >
        COOKING NOW
      </Text>
      <Text
        tone="inverse"
        className="pt-2 text-[18px]"
        style={{ fontFamily: fonts.manrope800 }}
      >
        {cooking.title}
      </Text>
      <Text className="pt-1 text-[12.5px]" style={{ color: '#B5A898' }}>
        Step {cooking.stepIndex + 1} of {cooking.stepCount}
      </Text>
      <View className="flex-row gap-1 py-3">
        {bars.map((_, index) => (
          <View
            key={`step-${String(index)}`}
            className="h-[5px] flex-1 rounded-full"
            style={{
              backgroundColor:
                index <= cooking.stepIndex
                  ? colors.paprika
                  : 'rgba(255,255,255,0.16)',
            }}
          />
        ))}
      </View>
      <View className="flex-row gap-2">
        <Button
          label="Resume"
          size="md"
          className="flex-1"
          onPress={() => router.push(`/cook/${cooking.recipeId}/step`)}
        />
        <Button
          label="Stop"
          variant="ghost"
          size="md"
          className="flex-1"
          style={{ borderWidth: 1, borderColor: colors.steamedMilk }}
          onPress={confirmStop}
        />
      </View>
    </View>
  );
}
