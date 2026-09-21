import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const TASTE = [
  'Italian',
  'Korean',
  'Quick weeknights',
  'Baking',
  'One-pan',
  'Vegetarian',
];

const SOURCES = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Website',
  'Photo',
  'Text',
] as const;

const STEPS = [
  {
    kicker: 'RECIME',
    title: 'Turn recipes you find anywhere into dinner.',
    body: 'Send us a reel, a link, a photo of a page. You get a recipe you can actually cook from.',
    cta: 'Next',
    foot: 'No account needed yet.',
  },
  {
    kicker: 'Your tastes',
    title: "Let's find something delicious.",
    body: "Pick a couple you like. We'll start there. You can change it any time.",
    cta: 'Next',
    foot: 'Tap a few, or skip.',
  },
  {
    kicker: 'Your sources',
    title: 'Try it on something now.',
    body: "Pick where you usually find recipes and we'll capture one for you.",
    cta: 'Capture a recipe',
    foot: "This one's on us. No signup.",
  },
] as const;

function ProgressDot({ index, step }: { index: number; step: number }) {
  const reduced = useReducedMotion();
  const width = useSharedValue(index === step ? 22 : 7);

  useEffect(() => {
    width.value = withTiming(index === step ? 22 : 7, {
      duration: reduced ? 0 : duration.fast,
      easing: reanimatedEasing,
    });
  }, [index, reduced, step, width]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      className="h-[7px] rounded-full"
      style={[
        style,
        {
          backgroundColor: index <= step ? colors.paprika : colors.ctaDisabled,
        },
      ]}
    />
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const tasteTags = usePreferencesStore((state) => state.tasteTags);
  const setTasteTags = usePreferencesStore((state) => state.setTasteTags);
  const completeOnboarding = usePreferencesStore(
    (state) => state.completeOnboarding,
  );
  const openCapture = useUiStore((state) => state.openCapture);
  const current = STEPS[step] ?? STEPS[0];

  const finish = (openSheet: boolean) => {
    completeOnboarding();
    router.replace('/');
    if (openSheet) {
      openCapture();
    }
  };

  return (
    <Screen
      className="bg-bg px-6 pb-[30px] pt-2"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View className="flex-none flex-row items-center gap-1.5 py-1.5">
        {[0, 1, 2].map((index) => (
          <ProgressDot key={index} index={index} step={step} />
        ))}
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={() => finish(false)}
          className="min-h-11 justify-center"
        >
          <Text
            className="text-[14.5px]"
            style={{ color: colors.cta, fontFamily: fonts.manrope600 }}
          >
            Skip
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 justify-center gap-[18px]">
        <Text variant="kicker">{current.kicker}</Text>
        <Text variant="display">{current.title}</Text>
        <Text
          variant="caption"
          className="max-w-[300px] text-[16.5px] leading-[1.5]"
        >
          {current.body}
        </Text>
        {step === 1 ? (
          <View className="flex-row flex-wrap gap-2.5 pt-1.5">
            {TASTE.map((tag) => {
              const selected = tasteTags.includes(tag);
              return (
                <Chip
                  key={tag}
                  label={tag}
                  selected={selected}
                  onPress={() =>
                    setTasteTags(
                      selected
                        ? tasteTags.filter((item) => item !== tag)
                        : [...tasteTags, tag],
                    )
                  }
                />
              );
            })}
          </View>
        ) : null}
        {step === 2 ? (
          <View className="flex-row flex-wrap gap-2.5 pt-1">
            {SOURCES.map((source) => (
              <View
                key={source}
                className="h-[72px] w-[30%] flex-1 items-center justify-center gap-[7px] rounded-[15px] border border-crust"
                style={{ backgroundColor: colors.paper }}
              >
                <SourceIcon source={source} size={28} />
                <Text variant="caption" className="text-[11px]">
                  {source}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View className="gap-2.5">
        <Button
          label={current.cta}
          size="lg"
          onPress={() => {
            if (step < 2) {
              setStep(step + 1);
              return;
            }
            finish(true);
          }}
        />
        <Text variant="caption" className="text-center">
          {current.foot}
        </Text>
      </View>
    </Screen>
  );
}
