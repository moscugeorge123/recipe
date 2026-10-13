import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  SCAN_BEAM_UNTIL,
  importStageLabel,
} from '@/features/extraction/import-stages';
import type { ImportSrc } from '@/features/extraction/import-jobs';
import { hueOf } from '@/tortie/color';
import { plz } from '@/tortie/lib/fmt';
import { C, CSS_EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { BrandLogo } from '@/tortie/ui/brand';
import { Glyph } from '@/tortie/ui/icon';
import { Orb } from '@/tortie/ui/keyframes';
import { Photo } from '@/tortie/ui/photo';
import { SlideText } from '@/tortie/ui/slide-text';
import { sans, serif, T } from '@/tortie/ui/text';

const PHOTO_H = 112;
const CHIP_W = [58, 76, 48, 66, 54, 72, 44, 62];
const STEP_W = ['92%', '78%', '85%'] as const;
const FROST = 'rgba(25,28,25,.58)';

/** 0–1 position of `pct` inside [from, to]. */
const span = (pct: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (pct - from) / (to - from)));

/**
 * The live "recipe being built" card. Header orb, stage caption and percentage;
 * a preview that fills in as progress passes each stage: scan beam over the
 * photo, ingredient chips, step rows, and a progress strip along the bottom.
 *
 * The API reports no partial recipe, so the chips and step rows are placeholders
 * that fill by progress. The title and photo come from the link preview when it
 * is available, and from the saved recipe at the end.
 */
export function ImportProgress({
  pct,
  recipe,
  src,
  url,
  title,
  thumb,
  hint,
  style,
}: {
  pct: number;
  recipe: { ingCount: number; stepCount: number } | null;
  src?: ImportSrc;
  url?: string;
  title?: string | null;
  thumb?: string | null;
  /** Caption under the card, e.g. "Keep browsing — it'll finish in the background". */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const shown = Math.round(Math.min(100, Math.max(0, pct)));
  const hue = useMemo(() => hueOf(url ?? 'import'), [url]);
  const meta = recipe
    ? [plz(recipe.ingCount, 'ingredient'), plz(recipe.stepCount, 'step')].join(
        ' · ',
      )
    : null;
  return (
    <View style={[{ marginTop: 20 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Orb size={40} radius={13} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <SlideText
            style={sans(15, 700, C.ink, { lineHeight: 20 })}
            height={20}
          >
            {importStageLabel(pct)}
          </SlideText>
          <T style={[sans(12, 400, C.ink2), { marginTop: 1 }]}>
            Building your recipe
          </T>
        </View>
        <T style={[sans(15, 700, C.terra), { fontVariant: ['tabular-nums'] }]}>
          {shown}%
        </T>
      </View>

      <View
        style={{
          marginTop: 14,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <Photo hue={hue} uri={thumb} style={{ height: PHOTO_H }}>
          <ScanBeam on={pct < SCAN_BEAM_UNTIL} />
          {src ? <SourceChip src={src} /> : null}
        </Photo>
        <View style={{ padding: 14, gap: 12 }}>
          <View style={{ gap: 6 }}>
            {title ? (
              <T numberOfLines={2} style={serif(19, 600)}>
                {title}
              </T>
            ) : (
              <Bone w="64%" h={18} on={pct >= 34} />
            )}
            {meta ? (
              <T style={sans(12, 400, C.ink2)}>{meta}</T>
            ) : (
              <Bone w="38%" h={11} on={pct >= 34} />
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CHIP_W.map((w, i) => (
              <Chip
                key={i}
                w={w}
                on={pct >= 34 + (i / CHIP_W.length) * (66 - 34)}
              />
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {STEP_W.map((w, i) => (
              <StepRow
                key={i}
                n={i + 1}
                w={w}
                fill={span(pct, 66 + i * 8, 66 + i * 8 + 12)}
              />
            ))}
          </View>
        </View>
        <Strip pct={pct} />
      </View>
      {hint ? (
        <T
          style={[
            sans(12, 600, C.ink2),
            { marginTop: 12, textAlign: 'center' },
          ]}
        >
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/** Terracotta beam sweeping down the photo while the page is being read. */
function ScanBeam({ on }: { on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(p);
  }, [p]);
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0, 300, CSS_EASE),
    transform: [{ translateY: p.value * (PHOTO_H - 28) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, height: 28 },
        a,
      ]}
    >
      <LinearGradient
        colors={['rgba(254,131,87,0)', 'rgba(254,131,87,.45)']}
        style={{ flex: 1 }}
      />
      <View
        style={{
          height: 2,
          backgroundColor: C.terraBright,
          boxShadow: '0 0 10px rgba(254,131,87,.9)',
        }}
      />
    </Animated.View>
  );
}

function SourceChip({ src }: { src: ImportSrc }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 10,
        bottom: 10,
        maxWidth: '80%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 26,
        paddingHorizontal: 10,
        borderRadius: 13,
        backgroundColor: FROST,
      }}
    >
      <SourceGlyph src={src} size={13} light />
      <T numberOfLines={1} style={[sans(12, 700, C.bg), { flexShrink: 1 }]}>
        {src.host}
      </T>
    </View>
  );
}

/** Brand logo, globe for a website, camera for a scanned page. */
export function SourceGlyph({
  src,
  size,
  light = false,
}: {
  src: ImportSrc;
  size: number;
  light?: boolean;
}) {
  if (src.kind === 'scan') {
    return (
      <Glyph
        name="photo_camera"
        size={size + 3}
        color={light ? C.bg : C.green}
      />
    );
  }
  if (src.kind === 'web') {
    return (
      <Glyph name="language" size={size + 3} color={light ? C.bg : C.green} />
    );
  }
  return (
    <BrandLogo brand={src.kind} size={size} color={light ? C.bg : undefined} />
  );
}

function Bone({ w, h, on }: { w: `${number}%`; h: number; on: boolean }) {
  const a = useAnimatedStyle(() => ({ opacity: tw(on ? 1 : 0.5, 400) }));
  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: h / 2,
          backgroundColor: C.surface3,
        },
        a,
      ]}
    />
  );
}

/** Ingredient chip: a bone until its turn, then a filled pill. */
function Chip({ w, on }: { w: number; on: boolean }) {
  const a = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.greenSoft : C.surface3, 350, CSS_EASE),
    transform: [{ scale: tw(on ? 1 : 0.94, 350) }],
  }));
  return (
    <Animated.View style={[{ width: w, height: 24, borderRadius: 12 }, a]} />
  );
}

function StepRow({ n, w, fill }: { n: number; w: `${number}%`; fill: number }) {
  const [bw, setBw] = useState(0);
  const bar = useAnimatedStyle(() => ({
    width: tw(bw * fill, 200, Easing.linear),
  }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: fill >= 1 ? C.green : C.surface3,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={sans(11, 700, fill >= 1 ? C.bg : C.ink3)}>{n}</T>
      </View>
      <View
        onLayout={(e) => setBw(e.nativeEvent.layout.width)}
        style={{
          width: w,
          height: 8,
          borderRadius: 4,
          backgroundColor: C.surface3,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[{ height: '100%', backgroundColor: C.greenSoft2 }, bar]}
        />
      </View>
    </View>
  );
}

function Strip({ pct }: { pct: number }) {
  const [w, setW] = useState(0);
  const fill = useAnimatedStyle(() => ({
    width: tw((w * pct) / 100, 90, Easing.linear),
  }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 4, backgroundColor: C.surface3 }}
    >
      <Animated.View
        style={[{ height: '100%', backgroundColor: C.terra }, fill]}
      />
    </View>
  );
}
