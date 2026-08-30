import { useMemo, type ComponentClass } from 'react';
import Animated from 'react-native-reanimated';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  type GProps,
} from 'react-native-svg';

import { daisy } from '@/components/daisy/colors';
import type { DaisyBeat, DaisyPhase } from '@/components/daisy/phase';
import { daisyPose } from '@/components/daisy/pose';
import {
  SPARKLE_POINTS,
  THOUGHT_DOT_POINTS,
  useDaisyMotion,
} from '@/components/daisy/use-daisy-motion';

// `matrix` is the group's only animatable transform prop natively, but
// react-native-svg keeps it off the public GProps type, so widen it here.
const AnimatedG = Animated.createAnimatedComponent(
  G as unknown as ComponentClass<GProps & { matrix?: number[] }>,
);

type DaisyCatProps = {
  phase: DaisyPhase;
  beat: DaisyBeat;
  blink: boolean;
  reducedMotion: boolean;
  size?: number;
  variant?: 'full' | 'face';
};

export function DaisyCat({
  phase,
  beat,
  blink,
  reducedMotion,
  size = 240,
  variant = 'full',
}: DaisyCatProps) {
  // Stable identity keeps the breathing and tail loops from restarting on every
  // blink or beat re-render.
  const pose = useMemo(() => daisyPose(phase, beat), [phase, beat]);
  const motion = useDaisyMotion(pose, reducedMotion, blink);
  const face = variant === 'face' || size < 96;
  const detail = face ? 'face' : size < 200 ? 'lite' : 'full';
  const height = Math.round(size * (234 / 260));

  return (
    <Svg
      width={size}
      height={face ? size : height}
      viewBox={face ? '70 20 120 140' : '0 0 260 234'}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {!face ? (
        <Ellipse
          cx={130}
          cy={226}
          rx={72}
          ry={7}
          fill={daisy.ink}
          opacity={0.07}
        />
      ) : null}

      {!face ? (
        <AnimatedG animatedProps={motion.tailProps}>
          <Path
            d="M184 192 C228 192 242 158 230 130"
            stroke={daisy.fur}
            strokeWidth={15}
            strokeLinecap="round"
            fill="none"
          />
        </AnimatedG>
      ) : null}

      <AnimatedG animatedProps={motion.bodyProps}>
        <Ellipse cx={130} cy={176} rx={62} ry={48} fill={daisy.fur} />
        <Ellipse cx={130} cy={184} rx={40} ry={30} fill={daisy.cream} />
        <Path
          d="M106 144 Q130 152 154 144"
          stroke={daisy.apron}
          strokeWidth={5}
          fill="none"
        />
        <Path
          d="M104 148 L156 148 Q160 148 160 154 L160 168 Q130 180 100 168 L100 154 Q100 148 104 148 Z"
          fill={daisy.apron}
        />
        <Path
          d="M94 166 Q130 180 166 166 L162 208 Q130 220 98 208 Z"
          fill={daisy.apron}
        />
        <Rect
          x={116}
          y={180}
          width={28}
          height={15}
          rx={7.5}
          fill="rgba(255,255,255,0.22)"
        />
      </AnimatedG>

      {detail === 'full' ? (
        <AnimatedG animatedProps={motion.clipProps}>
          <Rect
            x={88}
            y={198}
            width={84}
            height={26}
            rx={9}
            fill={daisy.clipboard}
          />
          <Rect
            x={98}
            y={206}
            width={40}
            height={4}
            rx={2}
            fill={daisy.clipboardLine}
          />
          <Rect
            x={98}
            y={214}
            width={56}
            height={4}
            rx={2}
            fill={daisy.clipboardLineSoft}
          />
        </AnimatedG>
      ) : null}

      {!face ? (
        <>
          <AnimatedG animatedProps={motion.pawLProps}>
            <Ellipse cx={104} cy={212} rx={15} ry={10.5} fill={daisy.fur} />
            <Ellipse cx={104} cy={214} rx={9} ry={5.5} fill={daisy.inner} />
          </AnimatedG>
          <AnimatedG animatedProps={motion.pawRProps}>
            <Ellipse cx={156} cy={212} rx={15} ry={10.5} fill={daisy.fur} />
            <Ellipse cx={156} cy={214} rx={9} ry={5.5} fill={daisy.inner} />
          </AnimatedG>
        </>
      ) : null}

      <AnimatedG animatedProps={motion.headProps}>
        <AnimatedG animatedProps={motion.earLProps}>
          <Path
            d="M88 72 L96 26 L126 52 Z"
            fill={daisy.fur}
            stroke={daisy.fur}
            strokeWidth={13}
            strokeLinejoin="round"
          />
          <Path d="M98 60 L102 42 L116 53 Z" fill={daisy.inner} />
        </AnimatedG>
        <AnimatedG animatedProps={motion.earRProps}>
          <Path
            d="M172 72 L164 26 L134 52 Z"
            fill={daisy.fur}
            stroke={daisy.fur}
            strokeWidth={13}
            strokeLinejoin="round"
          />
          <Path d="M162 60 L158 42 L144 53 Z" fill={daisy.inner} />
        </AnimatedG>

        <Ellipse cx={130} cy={96} rx={56} ry={50} fill={daisy.fur} />
        <Rect
          x={108}
          y={40}
          width={9}
          height={17}
          rx={4.5}
          fill={daisy.furDeep}
          transform="rotate(-16 112 48)"
        />
        <Rect
          x={125}
          y={35}
          width={9}
          height={19}
          rx={4.5}
          fill={daisy.furDeep}
        />
        <Rect
          x={142}
          y={40}
          width={9}
          height={17}
          rx={4.5}
          fill={daisy.furDeep}
          transform="rotate(16 147 48)"
        />

        {detail === 'full' ? (
          <G
            stroke={daisy.furDeep}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.85}
          >
            <Line x1={84} y1={112} x2={64} y2={107} />
            <Line x1={84} y1={122} x2={66} y2={126} />
            <Line x1={176} y1={112} x2={196} y2={107} />
            <Line x1={176} y1={122} x2={194} y2={126} />
          </G>
        ) : detail === 'lite' ? (
          <G
            stroke={daisy.furDeep}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.85}
          >
            <Line x1={84} y1={112} x2={74} y2={109} />
            <Line x1={176} y1={112} x2={186} y2={109} />
          </G>
        ) : null}

        <Ellipse cx={130} cy={120} rx={26} ry={17} fill={daisy.cream} />
        {detail === 'full' ? (
          <AnimatedG animatedProps={motion.blushProps}>
            <Ellipse cx={96} cy={113} rx={8} ry={4.5} fill={daisy.blush} />
            <Ellipse cx={164} cy={113} rx={8} ry={4.5} fill={daisy.blush} />
          </AnimatedG>
        ) : null}

        {pose.brow === 'raised' ? (
          <Path
            d="M146 70 Q154 64 162 69"
            stroke={daisy.furDeep}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {pose.brow === 'knit' ? (
          <G
            stroke={daisy.furDeep}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          >
            <Path d="M99 74 L114 79" />
            <Path d="M162 79 L177 74" />
          </G>
        ) : null}
        {pose.brow === 'sad' ? (
          <G
            stroke={daisy.furDeep}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          >
            <Path d="M99 80 L114 74" />
            <Path d="M162 74 L177 80" />
          </G>
        ) : null}

        {pose.eyeMode === 'happy' ? (
          <G
            stroke={daisy.ink}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          >
            <Path d="M96 99 Q106 86 116 99" />
            <Path d="M144 99 Q154 86 164 99" />
          </G>
        ) : (
          <>
            <AnimatedG animatedProps={motion.eyeLProps}>
              <Ellipse cx={106} cy={96} rx={9.5} ry={12} fill={daisy.ink} />
              <Circle cx={103} cy={91.5} r={3.2} fill={daisy.highlight} />
              <Circle
                cx={109.5}
                cy={99}
                r={1.7}
                fill={daisy.highlight}
                opacity={0.55}
              />
            </AnimatedG>
            <AnimatedG animatedProps={motion.eyeRProps}>
              <Ellipse cx={154} cy={96} rx={9.5} ry={12} fill={daisy.ink} />
              <Circle cx={151} cy={91.5} r={3.2} fill={daisy.highlight} />
              <Circle
                cx={157.5}
                cy={99}
                r={1.7}
                fill={daisy.highlight}
                opacity={0.55}
              />
            </AnimatedG>
          </>
        )}

        <Path
          d="M124 108 Q130 104 136 108 Q132.5 115 130 115 Q127.5 115 124 108 Z"
          fill={daisy.nose}
        />
        {mouth(pose.mouth)}

        <AnimatedG animatedProps={motion.glassesProps}>
          <Circle
            cx={106}
            cy={96}
            r={15.5}
            fill="rgba(255,255,255,0.16)"
            stroke={daisy.ink}
            strokeWidth={3.4}
          />
          <Circle
            cx={154}
            cy={96}
            r={15.5}
            fill="rgba(255,255,255,0.16)"
            stroke={daisy.ink}
            strokeWidth={3.4}
          />
          <Path
            d="M121.5 93 Q130 87 138.5 93"
            stroke={daisy.ink}
            strokeWidth={3.4}
            fill="none"
          />
          <Path
            d="M90.5 93 L83 88"
            stroke={daisy.ink}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
          <Path
            d="M169.5 93 L177 88"
            stroke={daisy.ink}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        </AnimatedG>

        {detail === 'full'
          ? THOUGHT_DOT_POINTS.map(([cx, cy, r], index) => (
              <AnimatedG
                key={`${cx}-${cy}`}
                animatedProps={motion.dotProps[index]}
              >
                <Circle cx={cx} cy={cy} r={r} fill={daisy.dots} />
              </AnimatedG>
            ))
          : null}

        <AnimatedG animatedProps={motion.questionProps}>
          <Path
            d="M202 30c0-7 6-12 14-12s14 5 14 12c0 8-8 10-11 16"
            stroke={daisy.furDeep}
            strokeWidth={4.5}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={216} cy={56} r={3.2} fill={daisy.furDeep} />
        </AnimatedG>
      </AnimatedG>

      {pose.sparkles
        ? SPARKLE_POINTS.map(([x, y], index) =>
            reducedMotion ? (
              <G key={`${x}-${y}`} opacity={0.85}>
                <Path
                  d="M0 -7 L4.5 0 L0 7 L-4.5 0 Z"
                  fill={daisy.spark}
                  transform={`translate(${x} ${y})`}
                />
              </G>
            ) : (
              <AnimatedG
                key={`${x}-${y}`}
                animatedProps={motion.sparkProps[index]}
              >
                <Path
                  d="M0 -7 L4.5 0 L0 7 L-4.5 0 Z"
                  fill={daisy.spark}
                  transform={`translate(${x} ${y})`}
                />
              </AnimatedG>
            ),
          )
        : null}
    </Svg>
  );
}

function mouth(kind: ReturnType<typeof daisyPose>['mouth']) {
  switch (kind) {
    case 'o':
      return <Ellipse cx={130} cy={124} rx={4.5} ry={5} fill={daisy.mouth} />;
    case 'hmm':
      return (
        <Path
          d="M124 125 Q131 121 137 125"
          stroke={daisy.ink}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'focused':
      return (
        <Path
          d="M123 124 L137 124"
          stroke={daisy.ink}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      );
    case 'grin':
      return (
        <G>
          <Path d="M115 117 Q130 138 145 117 Z" fill={daisy.mouth} />
          <Path d="M123 123 Q130 132 137 123 Z" fill={daisy.tongue} />
        </G>
      );
    case 'worry':
      return (
        <Path
          d="M123 127 Q130 120 137 127"
          stroke={daisy.ink}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
      );
    default:
      return (
        <Path
          d="M119 120 Q124.5 126 130 120 Q135.5 126 141 120"
          stroke={daisy.ink}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
      );
  }
}
