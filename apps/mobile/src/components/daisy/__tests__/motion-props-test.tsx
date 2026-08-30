import { render } from '@testing-library/react-native';
import { useEffect } from 'react';

import { daisyPose } from '@/components/daisy/pose';
import { useDaisyMotion } from '@/components/daisy/use-daisy-motion';

type Motion = ReturnType<typeof useDaisyMotion>;

function Probe({ onMotion }: { onMotion: (motion: Motion) => void }) {
  const motion = useDaisyMotion(daisyPose('analyzing', 'think'), false, false);

  useEffect(() => {
    onMotion(motion);
  }, [motion, onMotion]);

  return null;
}

// react-native-svg only accepts `matrix` and `opacity` natively on a group. Any
// transform expressed as rotation/originX/scale is dropped silently, which is
// why the mascot used to sit perfectly still.
const FORBIDDEN = [
  'rotation',
  'originX',
  'originY',
  'scale',
  'scaleX',
  'scaleY',
  'translateX',
  'translateY',
];

describe('useDaisyMotion', () => {
  const captured: { current: Motion | null } = { current: null };

  beforeEach(async () => {
    captured.current = null;
    await render(
      <Probe
        onMotion={(motion) => {
          captured.current = motion;
        }}
      />,
    );
  });

  test('drives every moving layer with a matrix', () => {
    const motion = captured.current;
    const layers: (keyof Motion)[] = [
      'bodyProps',
      'tailProps',
      'headProps',
      'earLProps',
      'earRProps',
      'eyeLProps',
      'eyeRProps',
      'glassesProps',
      'pawLProps',
      'pawRProps',
      'clipProps',
    ];

    layers.forEach((layer) => {
      expect(motion?.[layer]).toHaveProperty('matrix');
    });

    motion?.dotProps.forEach((dot) => {
      expect(dot).toHaveProperty('matrix');
    });
    motion?.sparkProps.forEach((spark) => {
      expect(spark).toHaveProperty('matrix');
    });
  });

  test('never animates props the native group ignores', () => {
    const props = Object.values(captured.current ?? {}).flat() as Record<
      string,
      unknown
    >[];

    expect(props.length).toBeGreaterThan(0);
    props.forEach((prop) => {
      FORBIDDEN.forEach((key) => {
        expect(prop).not.toHaveProperty(key);
      });
    });
  });

  test('fades opacity for the layers that appear and disappear', () => {
    expect(captured.current?.glassesProps).toHaveProperty('opacity');
    expect(captured.current?.blushProps).toHaveProperty('opacity');
    expect(captured.current?.questionProps).toHaveProperty('opacity');
    expect(captured.current?.clipProps).toHaveProperty('opacity');
  });
});
