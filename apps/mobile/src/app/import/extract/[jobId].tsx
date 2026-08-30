import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { cancelExtraction } from '@/features/extraction/api';
import { useExtractionJob } from '@/features/extraction/hooks/use-extraction-job';
import { EXTRACTION_STEP_LABELS } from '@/features/extraction/stage-map';
import { SEED_RECIPES } from '@/features/recipes/seed';
import { announce } from '@/lib/announce';
import {
  duration,
  reanimatedEasing,
  useBreathe,
  useReducedMotion,
} from '@/lib/motion';
import { colors, fonts } from '@/theme/tokens';

const CHIPS = [
  { label: 'IMAGE', to: { left: 154, top: 8, width: 150, height: 60 } },
  { label: 'TITLE', to: { left: 154, top: 74, width: 190, height: 26 } },
  {
    label: '8 INGREDIENTS',
    to: { left: 154, top: 106, width: 158, height: 26 },
  },
  { label: '8 STEPS', to: { left: 154, top: 138, width: 116, height: 26 } },
  { label: '25 MIN', to: { left: 154, top: 170, width: 86, height: 26 } },
  { label: 'SERVES 4', to: { left: 248, top: 170, width: 96, height: 26 } },
];

function ExtractChip({
  chip,
  index,
  done,
  reduced,
}: {
  chip: (typeof CHIPS)[number];
  index: number;
  done: boolean;
  reduced: boolean;
}) {
  const left = useSharedValue(14 + index * 8);
  const top = useSharedValue(10 + index * 28);
  const width = useSharedValue(88);
  const height = useSharedValue(24);

  useEffect(() => {
    const next = done
      ? chip.to
      : { left: 14 + index * 8, top: 10 + index * 28, width: 88, height: 24 };
    const cfg = reduced
      ? { duration: 0 }
      : { duration: duration.step, easing: reanimatedEasing };
    left.value = withTiming(next.left, cfg);
    top.value = withTiming(next.top, cfg);
    width.value = withTiming(next.width, cfg);
    height.value = withTiming(next.height, cfg);
  }, [chip.to, done, height, index, left, reduced, top, width]);

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    width: width.value,
    height: height.value,
    backgroundColor: done ? colors.espresso : 'rgba(255,255,255,0.9)',
  }));

  return (
    <Animated.View
      className="absolute items-center justify-center rounded-[9px] px-2.5"
      style={style}
    >
      <Text
        style={{
          fontFamily: fonts.mono700,
          fontSize: 10,
          letterSpacing: 0.8,
          color: done ? '#F7F1E8' : colors.olive,
        }}
      >
        {chip.label}
      </Text>
    </Animated.View>
  );
}

function ExtractRow({
  label,
  done,
  now,
}: {
  label: string;
  done: boolean;
  now: boolean;
}) {
  const breathe = useBreathe(now);

  return (
    <View className="flex-row items-center gap-3 py-[11px]">
      <Animated.View
        className="h-[22px] w-[22px] items-center justify-center rounded-full"
        style={[
          breathe,
          {
            backgroundColor: done
              ? colors.paprika
              : now
                ? colors.paprikaSoft
                : colors.linen,
            borderWidth: now ? 2 : 0,
            borderColor: colors.paprika,
          },
        ]}
      >
        <Text className="text-[11px]" tone="inverse">
          {done ? '✓' : ''}
        </Text>
      </Animated.View>
      <Text
        className="flex-1 text-[14.5px]"
        style={{
          fontFamily: done || now ? fonts.manrope600 : fonts.manrope500,
          color: done ? colors.espresso : now ? colors.paprika : colors.olive,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ExtractScreen() {
  const { jobId, thumbnailUrl } = useLocalSearchParams<{
    jobId: string;
    thumbnailUrl?: string;
  }>();
  const stillUri = thumbnailUrl ? String(thumbnailUrl) : undefined;
  const { job, uiStage, headline, isTerminal, isFailed } =
    useExtractionJob(jobId);
  const reduced = useReducedMotion();
  const pistachio = SEED_RECIPES[0];

  useEffect(() => {
    announce(headline);
  }, [headline]);

  useEffect(() => {
    if (job?.status === 'COMPLETED' && job.recipeId) {
      router.replace(`/import/review/${job.recipeId}`);
    }
  }, [job?.recipeId, job?.status]);

  useEffect(() => {
    if (isFailed) {
      router.replace({
        pathname: '/import/error',
        params: { code: 'EXTRACTION_FAILED' },
      });
    }
  }, [isFailed]);

  return (
    <Screen className="px-5">
      <Text variant="mono" className="pb-2 pt-1">
        READING POST
      </Text>
      <Text variant="display" accessibilityLiveRegion="polite">
        {headline}
      </Text>
      <View className="my-[22px] h-[266px] overflow-hidden rounded-[20px] border border-crust bg-peach">
        <View className="absolute left-2.5 top-2.5 w-[124px]">
          <PhotoStandIn
            uri={stillUri}
            colors={pistachio?.placeholder ?? ['#E6D9C4', '#DCCBB0']}
            height={246}
            radius={14}
            label="source post"
          />
        </View>
        {CHIPS.map((chip, index) => (
          <ExtractChip
            key={chip.label}
            chip={chip}
            index={index}
            done={uiStage >= Math.min(index, 5)}
            reduced={reduced}
          />
        ))}
      </View>
      {EXTRACTION_STEP_LABELS.map((label, index) => {
        const done = uiStage > index;
        const now = uiStage === index && !isTerminal;
        return <ExtractRow key={label} label={label} done={done} now={now} />;
      })}
      <Text variant="caption" className="pt-4">
        {`You can leave this screen — we'll finish in the background and tell you when it's ready.`}
      </Text>
      {jobId && !isTerminal ? (
        <Button
          label="Cancel"
          variant="ghost"
          className="mt-4"
          onPress={() => {
            cancelExtraction(jobId).catch(() => undefined);
            router.replace('/');
          }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        className="mt-2 h-11 justify-center"
      >
        <Text tone="primary">Leave for now</Text>
      </Pressable>
    </Screen>
  );
}
