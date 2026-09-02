import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { daisy } from '@/components/daisy/colors';
import {
  DAISY_COPY,
  DaisyMascot,
  daisyCopyBucketForPhase,
  daisyCopyBucketFromJob,
  daisyPhaseFromJob,
  formatSourcePill,
  useDaisyCopy,
  useDaisyDisplayPhase,
} from '@/components/daisy';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { cancelExtraction } from '@/features/extraction/api';
import { useExtractionJob } from '@/features/extraction/hooks/use-extraction-job';
import { announce } from '@/lib/announce';
import { useReducedMotion } from '@/lib/motion';
import { typeface } from '@/theme/tokens';

export default function ExtractScreen() {
  const { jobId, url } = useLocalSearchParams<{
    jobId: string;
    url?: string;
    thumbnailUrl?: string;
  }>();
  const { job, isTerminal, isFailed } = useExtractionJob(jobId);
  const reduced = useReducedMotion();
  const jobPhase = daisyPhaseFromJob(job?.status, job?.currentStage);
  const jobBucket = daisyCopyBucketFromJob(job?.status, job?.currentStage);
  const { phase, successReady } = useDaisyDisplayPhase(jobPhase, reduced);
  const bucket = daisyCopyBucketForPhase(phase, jobBucket);
  const status = useDaisyCopy(bucket);
  const source = url ? formatSourcePill(String(url)) : '';
  const busy =
    bucket === 'importing' ||
    bucket === 'analyzing' ||
    bucket === 'extracting' ||
    bucket === 'processing';
  const statusColor =
    bucket === 'success'
      ? daisy.successCopy
      : bucket === 'error'
        ? daisy.error
        : daisy.ink;

  useEffect(() => {
    announce(DAISY_COPY[bucket][0] ?? '');
  }, [bucket]);

  useEffect(() => {
    if (successReady && job?.status === 'COMPLETED' && job.recipeId) {
      router.replace(`/import/review/${job.recipeId}`);
    }
  }, [job?.recipeId, job?.status, successReady]);

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
      <View className="flex-1">
        <View className="items-center pt-10">
          {source ? (
            <View
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: daisy.pillBg,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  ...typeface('semibold'),
                  fontSize: 12,
                  color: daisy.quiet,
                }}
              >
                {source}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-1 justify-center">
          <DaisyMascot phase={phase} size={240} />
        </View>

        <View className="items-center px-4 pb-2 pt-1">
          <StatusLine color={statusColor} reduced={reduced} text={status} />
          {busy ? <StatusDots reduced={reduced} /> : null}
        </View>

        {jobId && !isTerminal ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel import"
            onPress={() => {
              cancelExtraction(jobId).catch(() => undefined);
              router.replace('/');
            }}
            className="h-11 items-center justify-center"
          >
            <Text
              style={{
                ...typeface('semibold'),
                fontSize: 14,
                color: daisy.quiet,
              }}
            >
              Cancel import
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

// m-fade: each new line fades up over .5s instead of swapping instantly.
function StatusLine({
  text,
  color,
  reduced,
}: {
  text: string;
  color: string;
  reduced: boolean;
}) {
  const enter = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      enter.value = withTiming(1, { duration: 400 });
      return;
    }
    enter.value = 0;
    enter.value = withTiming(1, { duration: 500 });
  }, [enter, reduced, text]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 4 }],
  }));

  return (
    <Animated.View style={style}>
      <Text
        accessibilityLiveRegion="polite"
        style={{
          ...typeface('semibold'),
          fontSize: 15,
          color,
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

function StatusDots({ reduced }: { reduced: boolean }) {
  return (
    <View className="mt-3 flex-row justify-center" style={{ gap: 5 }}>
      {[0, 1, 2].map((index) => (
        <StatusDot key={index} index={index} reduced={reduced} />
      ))}
    </View>
  );
}

function StatusDot({ index, reduced }: { index: number; reduced: boolean }) {
  const pulse = useSharedValue(reduced ? 0.6 : 0.25);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withDelay(
      index * 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700 }),
          withTiming(0.25, { duration: 700 }),
        ),
        -1,
        false,
      ),
    );
  }, [index, pulse, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [
      { translateY: reduced ? 0 : ((pulse.value - 0.25) / 0.75) * -3 },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: daisy.apron,
        },
      ]}
    />
  );
}
