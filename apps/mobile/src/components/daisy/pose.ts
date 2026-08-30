import type { DaisyBeat, DaisyPhase } from '@/components/daisy/phase';

export type DaisyMouth = 'content' | 'o' | 'hmm' | 'focused' | 'grin' | 'worry';
export type DaisyBrow = 'none' | 'raised' | 'knit' | 'sad';
export type DaisyPaw = 'down' | 'chin' | 'raise';
export type DaisyEyeMode = 'open' | 'happy';

export type DaisyPose = {
  pupil: [number, number];
  eyeMode: DaisyEyeMode;
  eyeScale: number;
  brow: DaisyBrow;
  mouth: DaisyMouth;
  earL: number;
  earR: number;
  head: [number, number, number];
  glasses: boolean;
  paw: DaisyPaw;
  sparkles: boolean;
  q: boolean;
  dots: boolean;
  typing: boolean;
  blushO: number;
  tailFast: boolean;
};

export function daisyPose(phase: DaisyPhase, beat: DaisyBeat): DaisyPose {
  const pose: DaisyPose = {
    pupil: [0, 0],
    eyeMode: 'open',
    eyeScale: 1,
    brow: 'none',
    mouth: 'content',
    earL: 0,
    earR: 0,
    head: [0, 0, 0],
    glasses: false,
    paw: 'down',
    sparkles: false,
    q: false,
    dots: false,
    typing: false,
    blushO: 0.45,
    tailFast: false,
  };

  if (phase === 'importing') {
    pose.pupil = [3, -3];
    pose.eyeScale = 1.12;
    pose.earL = 7;
    pose.earR = -7;
    pose.head = [2, -2, -3];
    pose.mouth = 'o';
  }

  if (phase === 'analyzing') {
    pose.glasses = true;
    if (beat === 'lookL') {
      pose.pupil = [-4, 1];
      pose.head = [-3, 0, -3];
    } else if (beat === 'lookR') {
      pose.pupil = [4, 1];
      pose.head = [3, 0, 3];
    } else if (beat === 'think') {
      pose.pupil = [2, -3];
      pose.brow = 'raised';
      pose.paw = 'chin';
      pose.dots = true;
      pose.mouth = 'hmm';
    } else if (beat === 'check') {
      pose.pupil = [-2, 3];
      pose.eyeScale = 0.88;
      pose.mouth = 'focused';
      pose.head = [0, 2, 0];
    }
  }

  if (phase === 'processing') {
    pose.glasses = true;
    pose.pupil = [0, 4];
    pose.eyeScale = 0.9;
    pose.mouth = 'focused';
    pose.brow = 'knit';
    pose.typing = true;
    pose.head = [0, 3, 0];
  }

  if (phase === 'success') {
    pose.eyeMode = 'happy';
    pose.mouth = 'grin';
    pose.earL = 6;
    pose.earR = -6;
    pose.paw = 'raise';
    pose.sparkles = true;
    pose.blushO = 0.7;
    pose.head = [0, -2, 0];
    pose.tailFast = true;
  }

  if (phase === 'error') {
    pose.earL = -16;
    pose.earR = 16;
    pose.brow = 'sad';
    pose.mouth = 'worry';
    pose.pupil = [0, 2];
    pose.head = [0, 2, 5];
    pose.q = true;
    pose.blushO = 0.3;
  }

  return pose;
}
