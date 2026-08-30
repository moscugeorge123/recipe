import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { affine, translate } from '@/components/daisy/matrix';
import type { DaisyPose } from '@/components/daisy/pose';

// Timings lifted verbatim from the prototype's keyframes and transitions.
const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1); // .55s pose spring
const SINE = Easing.inOut(Easing.sin);
const EASE_OUT = Easing.out(Easing.ease);
const POSE_MS = 550;
const PUPIL_MS = 220;
const FADE_MS = 400;
const BLINK_MS = 130;
const BREATHE_MS = 3400;
const TAIL_MS = 2800;
const TAIL_FAST_MS = 1100;
const TYPE_MS = 500;
const DOT_MS = 1600;
const DOT_STAGGER_MS = 250;
const SPARK_MS = 1400;
const SPARK_STAGGER_MS = 150;

// Pivots, in mascot coordinates, matching the prototype's transform-origins.
const BODY_PIVOT = [130, 220] as const;
const TAIL_PIVOT = [184, 192] as const;
const HEAD_PIVOT = [130, 127] as const;
const EAR_L_PIVOT = [122, 76] as const;
const EAR_R_PIVOT = [138, 76] as const;
const EYE_L = [106, 96] as const;
const EYE_R = [154, 96] as const;
const PAW_R_PIVOT = [156, 212] as const;

export const SPARKLE_POINTS = [
  [62, 44],
  [198, 36],
  [50, 100],
  [210, 90],
  [130, 10],
] as const;

export const THOUGHT_DOT_POINTS = [
  [190, 56, 3.5],
  [202, 42, 5],
  [216, 26, 6.5],
] as const;

function pingPong(halfMs: number) {
  return withRepeat(
    withSequence(
      withTiming(1, { duration: halfMs, easing: SINE }),
      withTiming(0, { duration: halfMs, easing: SINE }),
    ),
    -1,
    false,
  );
}

function loop(cycleMs: number, easing = Easing.linear) {
  return withRepeat(withTiming(1, { duration: cycleMs, easing }), -1, false);
}

export function useDaisyMotion(
  pose: DaisyPose,
  reduced: boolean,
  blink: boolean,
) {
  const breath = useSharedValue(0);
  const tail = useSharedValue(0);
  const typeL = useSharedValue(0);
  const typeR = useSharedValue(0);
  const dotClock = useSharedValue(0);
  const sparkClock = useSharedValue(0);

  const headX = useSharedValue(pose.head[0]);
  const headY = useSharedValue(pose.head[1]);
  const headRot = useSharedValue(pose.head[2]);
  const earL = useSharedValue(pose.earL);
  const earR = useSharedValue(pose.earR);
  const pupilX = useSharedValue(pose.pupil[0]);
  const pupilY = useSharedValue(pose.pupil[1]);
  const eyeScale = useSharedValue(pose.eyeScale);
  const glassesOn = useSharedValue(pose.glasses ? 1 : 0);
  const glassesDrop = useSharedValue(pose.glasses ? 0 : 1);
  const pawX = useSharedValue(0);
  const pawY = useSharedValue(0);
  const pawRot = useSharedValue(0);
  const blush = useSharedValue(pose.blushO);
  const dots = useSharedValue(pose.dots ? 1 : 0);
  const question = useSharedValue(pose.q ? 1 : 0);
  const clipboard = useSharedValue(pose.typing ? 1 : 0);
  const sparkOn = useSharedValue(pose.sparkles ? 1 : 0);

  // Pose targets. Transforms snap under reduced motion; opacity always fades.
  useEffect(() => {
    const spring = (value: { value: number }, to: number, ms = POSE_MS) => {
      value.value = reduced
        ? withTiming(to, { duration: 0 })
        : withTiming(to, { duration: ms, easing: SPRING });
    };
    const fade = (value: { value: number }, to: number) => {
      value.value = withTiming(to, { duration: FADE_MS });
    };

    spring(headX, pose.head[0]);
    spring(headY, pose.head[1]);
    spring(headRot, pose.head[2]);
    spring(earL, pose.earL);
    spring(earR, pose.earR);
    spring(pupilX, pose.pupil[0], PUPIL_MS);
    spring(pupilY, pose.pupil[1], PUPIL_MS);
    spring(glassesDrop, pose.glasses ? 0 : 1);

    const paw =
      pose.paw === 'chin'
        ? { x: -14, y: -66, rot: -22 }
        : pose.paw === 'raise'
          ? { x: 12, y: -56, rot: 24 }
          : { x: 0, y: 0, rot: 0 };
    spring(pawX, paw.x);
    spring(pawY, paw.y);
    spring(pawRot, paw.rot);

    fade(glassesOn, pose.glasses ? 1 : 0);
    fade(blush, pose.blushO);
    fade(dots, pose.dots ? 1 : 0);
    fade(question, pose.q ? 1 : 0);
    fade(clipboard, pose.typing ? 1 : 0);
    fade(sparkOn, pose.sparkles ? 1 : 0);
  }, [
    blush,
    clipboard,
    dots,
    earL,
    earR,
    glassesDrop,
    glassesOn,
    headRot,
    headX,
    headY,
    pawRot,
    pawX,
    pawY,
    pose,
    pupilX,
    pupilY,
    question,
    reduced,
    sparkOn,
  ]);

  // Blink runs on its own timer, so it must not disturb the base loops.
  useEffect(() => {
    const closing = blink && !reduced;
    eyeScale.value = withTiming(closing ? 0.08 : pose.eyeScale, {
      duration: reduced ? 0 : closing ? BLINK_MS : PUPIL_MS,
    });
  }, [blink, eyeScale, pose.eyeScale, reduced]);

  // One effect per layer: a pose change must never reset a running cycle.
  useEffect(() => {
    cancelAnimation(breath);
    breath.value = reduced ? 0 : pingPong(BREATHE_MS / 2);
  }, [breath, reduced]);

  useEffect(() => {
    cancelAnimation(tail);
    tail.value = reduced
      ? 0
      : pingPong((pose.tailFast ? TAIL_FAST_MS : TAIL_MS) / 2);
  }, [pose.tailFast, reduced, tail]);

  useEffect(() => {
    cancelAnimation(typeL);
    cancelAnimation(typeR);
    if (reduced) {
      typeL.value = 0;
      typeR.value = 0;
      return;
    }
    if (pose.typing) {
      typeL.value = pingPong(TYPE_MS / 2);
      // The right paw lags half a cycle, matching the .25s keyframe delay.
      typeR.value = withDelay(TYPE_MS / 2, pingPong(TYPE_MS / 2));
      return;
    }
    typeL.value = withTiming(0, { duration: PUPIL_MS });
    typeR.value = withTiming(0, { duration: PUPIL_MS });
  }, [pose.typing, reduced, typeL, typeR]);

  useEffect(() => {
    cancelAnimation(dotClock);
    dotClock.value = reduced || !pose.dots ? 0 : loop(DOT_MS, SINE);
  }, [dotClock, pose.dots, reduced]);

  useEffect(() => {
    cancelAnimation(sparkClock);
    sparkClock.value = reduced || !pose.sparkles ? 0 : loop(SPARK_MS, EASE_OUT);
  }, [pose.sparkles, reduced, sparkClock]);

  // m-breathe: scale(1) -> scale(1.015, 1.035) from the apron hem.
  const bodyProps = useAnimatedProps(() => ({
    matrix: affine(
      0,
      0,
      0,
      1 + breath.value * 0.015,
      1 + breath.value * 0.035,
      BODY_PIVOT[0],
      BODY_PIVOT[1],
    ),
  }));

  // m-sway: -5deg <-> 9deg from the base of the tail.
  const tailProps = useAnimatedProps(() => ({
    matrix: affine(
      0,
      0,
      interpolate(tail.value, [0, 1], [-5, 9]),
      1,
      1,
      TAIL_PIVOT[0],
      TAIL_PIVOT[1],
    ),
  }));

  const headProps = useAnimatedProps(() => ({
    matrix: affine(
      headX.value,
      headY.value,
      headRot.value,
      1,
      1,
      HEAD_PIVOT[0],
      HEAD_PIVOT[1],
    ),
  }));

  const earLProps = useAnimatedProps(() => ({
    matrix: affine(0, 0, earL.value, 1, 1, EAR_L_PIVOT[0], EAR_L_PIVOT[1]),
  }));

  const earRProps = useAnimatedProps(() => ({
    matrix: affine(0, 0, earR.value, 1, 1, EAR_R_PIVOT[0], EAR_R_PIVOT[1]),
  }));

  const eyeLProps = useAnimatedProps(() => ({
    matrix: affine(
      pupilX.value,
      pupilY.value,
      0,
      1,
      eyeScale.value,
      EYE_L[0],
      EYE_L[1],
    ),
  }));

  const eyeRProps = useAnimatedProps(() => ({
    matrix: affine(
      pupilX.value,
      pupilY.value,
      0,
      1,
      eyeScale.value,
      EYE_R[0],
      EYE_R[1],
    ),
  }));

  // The signature beat: the frames drop 24px onto the nose.
  const glassesProps = useAnimatedProps(() => ({
    opacity: glassesOn.value,
    matrix: translate(0, glassesDrop.value * -24),
  }));

  // m-type: a 6px bounce, left paw leading.
  const pawLProps = useAnimatedProps(() => ({
    matrix: translate(0, typeL.value * -6),
  }));

  const pawRProps = useAnimatedProps(() => ({
    matrix: affine(
      pawX.value,
      pawY.value + typeR.value * -6,
      pawRot.value,
      1,
      1,
      PAW_R_PIVOT[0],
      PAW_R_PIVOT[1],
    ),
  }));

  const blushProps = useAnimatedProps(() => ({ opacity: blush.value }));
  const questionProps = useAnimatedProps(() => ({ opacity: question.value }));

  const clipProps = useAnimatedProps(() => ({
    opacity: clipboard.value,
    matrix: translate(0, (1 - clipboard.value) * 10),
  }));

  const dotProps = [
    useAnimatedProps(() => dotFrame(dotClock.value, dots.value, 0)),
    useAnimatedProps(() =>
      dotFrame(dotClock.value, dots.value, DOT_STAGGER_MS / DOT_MS),
    ),
    useAnimatedProps(() =>
      dotFrame(dotClock.value, dots.value, (DOT_STAGGER_MS * 2) / DOT_MS),
    ),
  ];

  const sparkProps = [
    useAnimatedProps(() => sparkFrame(sparkClock.value, sparkOn.value, 0, 0)),
    useAnimatedProps(() =>
      sparkFrame(
        sparkClock.value,
        sparkOn.value,
        SPARK_STAGGER_MS / SPARK_MS,
        1,
      ),
    ),
    useAnimatedProps(() =>
      sparkFrame(
        sparkClock.value,
        sparkOn.value,
        (SPARK_STAGGER_MS * 2) / SPARK_MS,
        2,
      ),
    ),
    useAnimatedProps(() =>
      sparkFrame(
        sparkClock.value,
        sparkOn.value,
        (SPARK_STAGGER_MS * 3) / SPARK_MS,
        3,
      ),
    ),
    useAnimatedProps(() =>
      sparkFrame(
        sparkClock.value,
        sparkOn.value,
        (SPARK_STAGGER_MS * 4) / SPARK_MS,
        4,
      ),
    ),
  ];

  return {
    bodyProps,
    tailProps,
    headProps,
    earLProps,
    earRProps,
    eyeLProps,
    eyeRProps,
    glassesProps,
    pawLProps,
    pawRProps,
    blushProps,
    questionProps,
    clipProps,
    dotProps,
    sparkProps,
  };
}

// m-dot: opacity .25 -> 1 -> .25 with a 3px rise.
function dotFrame(progress: number, on: number, offset: number) {
  'worklet';
  const local = (progress + offset) % 1;
  const wave = interpolate(local, [0, 0.5, 1], [0, 1, 0]);
  return {
    opacity: on * (0.25 + wave * 0.75),
    matrix: translate(0, wave * -3),
  };
}

// m-pop: scale 0 -> 1.3 -> .4 with a 40deg spin, fading out at the end.
function sparkFrame(
  progress: number,
  on: number,
  offset: number,
  index: number,
) {
  'worklet';
  const point = SPARKLE_POINTS[index] ?? SPARKLE_POINTS[0];
  const local = (progress + offset) % 1;
  const scale = interpolate(local, [0, 0.4, 1], [0, 1.3, 0.4]);
  return {
    opacity: on * interpolate(local, [0, 0.4, 1], [0, 1, 0]),
    matrix: affine(
      0,
      0,
      interpolate(local, [0, 0.4, 1], [0, 20, 40]),
      scale,
      scale,
      point[0],
      point[1],
    ),
  };
}
