import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  useActiveCook,
  useFinishCooking,
} from '@/features/cook-sessions/hooks';
import { colors, fonts, radii, shadows } from '@/theme/tokens';

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
      className="mx-5 mb-[26px] p-6"
      style={{
        backgroundColor: colors.cream,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.crust,
        ...shadows.float,
      }}
    >
      <Text
        className="text-xs leading-4"
        style={{ fontFamily: fonts.bold, color: colors.olive }}
      >
        COOKING NOW
      </Text>
      <Text
        className="pt-2 text-[21px] leading-[30px]"
        style={{ fontFamily: fonts.bold, color: colors.espresso }}
      >
        {cooking.title}
      </Text>
      <Text className="pt-1 text-sm" style={{ color: colors.olive }}>
        Step {cooking.stepIndex + 1} of {cooking.stepCount}
      </Text>
      <View className="flex-row gap-1 py-3">
        {bars.map((_, index) => (
          <View
            key={`step-${String(index)}`}
            className="h-[5px] flex-1 rounded-full"
            style={{
              backgroundColor:
                index <= cooking.stepIndex ? colors.paprika : colors.steam,
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
          variant="secondary"
          size="md"
          className="flex-1"
          onPress={confirmStop}
        />
      </View>
    </View>
  );
}
