import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import {
  advancePlayback,
  barPieces,
  barSegments,
  clipForStep,
  clipIndexForStep,
  clipRangeLabel,
  clipStartLabel,
  isVerticalVideo,
  moveTo,
  nextLabel,
  openLink,
  platformOf,
  playbackLeft,
  playbackRange,
  prevLabel,
  seekPlayback,
  startPlayback,
  timelineEnd,
  togglePlayback,
  type ClipPlayback,
  type StepClip,
} from '@/tortie/data/step-clips';
import { clipSourceKey } from '@/tortie/data/clip-source';
import { useTRecipe, type TDetail } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { clock } from '@/tortie/lib/fmt';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, F } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { BrandLogo } from '@/tortie/ui/brand';
import { Grabber, SheetClose } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import {
  ClipPlayer,
  type ClipDriver,
  type ClipStatus,
} from '@/tortie/screens/clip-player';
import { Sheet } from '@/tortie/ui/sheet';
import {
  OpenInNewIcon,
  SkipNextIcon,
  SkipPreviousIcon,
} from '@/tortie/ui/svg-icons';
import { sans, serif, T } from '@/tortie/ui/text';
import { useT } from '@/i18n';
import { tNow } from '@/i18n/format';

const EMPTY: StepClip[] = [];
const PLAYER_BG = '#191c19';
const STRIPE_A = '#262a26';
const STRIPE_B = '#2e332e';
const VIDEO_LABEL = '#9aa39a';
const NUMERIC = { fontVariant: ['tabular-nums' as const] };

/* ───────────────────────────── "Watch step" chip ───────────────────────────── */

/**
 * Opens the step's clip. `large` is the cook mode version ("Watch this step 0:29–0:51");
 * the method row shows "Watch step 0:29".
 */
export function WatchStepChip({
  label,
  time,
  large = false,
  onPress,
}: {
  label: string;
  time: string;
  large?: boolean;
  onPress: () => void;
}) {
  const tr = useT();
  const disc = large ? 38 : 26;
  return (
    <Press
      onPress={onPress}
      scale={large ? 0.96 : 0.95}
      easing={CSS_EASE}
      accessibilityRole="button"
      accessibilityLabel={tr('clip.watchThisStepIn')}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: large ? 10 : 7,
        height: large ? 52 : 34,
        marginTop: large ? 18 : 10,
        paddingLeft: large ? 7 : 4,
        paddingRight: large ? 18 : 12,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 99,
        backgroundColor: C.surface,
        ...(large
          ? { boxShadow: '0 10px 24px -16px rgba(44,52,45,.3)' }
          : null),
      }}
    >
      <View
        style={{
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: C.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name="play_arrow" size={large ? 24 : 18} color={C.bg} fill />
      </View>
      <T style={sans(large ? 15 : 12, 700, C.ink)}>{label}</T>
      <T style={sans(large ? 15 : 12, 600, C.ink3, NUMERIC)}>{time}</T>
    </Press>
  );
}

/**
 * The chip for one method step, or nothing when the step has no clip.
 * `large` is cook mode's "Watch this step 0:29–0:51" ("2 parts · 0:34" when the video comes
 * back to the step); the method row shows "Watch step 0:29".
 *
 * It opens the Step clip sheet, or the source in its own app when the app cannot play it
 * (Instagram without the stored-video flag, short links with no video id).
 */
export function StepClipChip({
  recipe,
  step,
  large = false,
}: {
  recipe: Pick<TDetail, 'id' | 'clips' | 'clipPlayer' | 'originalUrl'>;
  step: number;
  large?: boolean;
}) {
  const tr = useT();
  const clip = clipForStep(recipe.clips, step);
  const link = clip
    ? openLink(recipe.originalUrl, platformOf(recipe.originalUrl), clip.start)
    : null;
  if (!clip || (!recipe.clipPlayer && !link)) return null;
  const onPress = () => {
    if (recipe.clipPlayer) useNav.getState().openClip(recipe.id, step);
    else if (link) {
      Linking.openURL(link.href).catch(() =>
        toast(tr('common.couldntOpenThatLink'), 'error'),
      );
    }
  };
  return (
    <WatchStepChip
      large={large}
      label={large ? tr('clip.watchThisStep') : tr('clip.watchStep')}
      time={large ? clipRangeLabel(clip) : clipStartLabel(clip)}
      onPress={onPress}
    />
  );
}

/* ─────────────────────────────── Step clip sheet ─────────────────────────────── */

/**
 * Plays the step's parts of the source video one after another. It opens paused on the
 * step's first frame and plays when the user asks; closing pauses it, and reopening the same
 * step carries on from there. Cook mode follows the step the viewer closed on.
 *
 * YouTube, TikTok and Facebook play in the platform's embedded player; Instagram plays the
 * stored video behind a flag (see `clip-source.ts`). A player that fails shows the striped
 * placeholder, with the "Open on ..." link below.
 */
export function StepClipSheet() {
  const tr = useT();
  const f = useFrame();
  const open = useNav((s) => s.clipOn);
  const id = useNav((s) => s.clipId);
  const startStep = useNav((s) => s.clipStep);
  const nonce = useNav((s) => s.clipNonce);
  const { r } = useTRecipe(id);
  const clips = r?.clips ?? EMPTY;
  const duration = r?.view.sourceDurationSeconds ?? null;
  const pieces = useMemo(() => barPieces(clips, duration), [clips, duration]);

  // A player that fails to load leaves the placeholder.
  const [failed, setFailed] = useState<string | null>(null);
  const src = r?.clipPlayer ?? null;
  const key = src ? clipSourceKey(src) : null;
  const source = src && key !== failed ? src : null;
  const drv = useRef<ClipDriver>(null);
  const [loading, setLoading] = useState(false);

  const [p, setP] = useState<ClipPlayback | null>(null);
  const pRef = useRef<ClipPlayback | null>(null);
  useEffect(() => {
    pRef.current = p;
  }, [p]);

  const [pid, setPid] = useState(id);
  const [seen, setSeen] = useState(nonce);
  if (id !== pid) {
    setPid(id);
    setP(null);
  } else if (nonce !== seen) {
    setSeen(nonce);
    const idx = clipIndexForStep(clips, startStep);
    // Same step as last time and not finished: carry on from where it was paused.
    const resume =
      p && p.idx === idx && !p.ended && clips[idx]?.step === startStep;
    setP(resume ? { ...p, playing: false } : startPlayback(clips, idx));
  } else if (open && !p && clips.length) {
    // The recipe was still loading when the sheet opened; start as soon as the clips arrive.
    setP(startPlayback(clips, clipIndexForStep(clips, startStep)));
  }

  /** Apply a new playback state; `seek` moves the player to its position. */
  const go = (next: ClipPlayback | null, seek = true) => {
    if (!next) return;
    pRef.current = next;
    setP(next);
    if (seek) drv.current?.seek(next.pos);
  };

  // Show the right frame as soon as the sheet opens (and once the clips arrive).
  const hasP = p !== null;
  useEffect(() => {
    const cur = pRef.current;
    if (cur) drv.current?.seek(cur.pos);
  }, [nonce, hasP, key]);

  const playing = open && !!p?.playing;
  useEffect(() => {
    if (playing) drv.current?.play();
    else drv.current?.pause();
  }, [playing, key]);

  // Follow the player's clock, chaining the step's parts and stopping after the last.
  const onTime = (time: number) => {
    const cur = pRef.current;
    if (!cur) return;
    const next = advancePlayback(clips, cur, time);
    if (next.p === cur) return;
    if (next.seek !== undefined) drv.current?.seek(next.seek);
    if (next.p.ended) drv.current?.pause();
    pRef.current = next.p;
    setP(next.p);
  };

  // Only the first load seeks to the opening frame. A file player goes through `loading` and
  // back to `ready` on every seek, so seeking on each one would loop forever.
  const primed = useRef<string | null>(null);
  const onStatus = (status: ClipStatus) => {
    setLoading(status === 'loading');
    if (status === 'ready' && primed.current !== key && pRef.current) {
      primed.current = key;
      drv.current?.seek(pRef.current.pos);
    }
    if (status === 'error') setFailed(key);
  };

  // Closing pauses on the current frame and hands the step back to cook mode.
  const wasOpen = useRef(open);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    setP((cur) => (cur ? { ...cur, playing: false } : cur));
    const step = clips[pRef.current?.idx ?? -1]?.step;
    if (step !== undefined) useNav.getState().clipReturned(step);
  }, [open, clips]);

  const close = () => useNav.getState().closeClip();

  const idx = p?.idx ?? 0;
  const clip = clips[idx];
  const step = clip ? r?.steps[clip.step] : undefined;
  const url = r?.originalUrl ?? null;
  const platform = platformOf(url);
  const vertical = isVerticalVideo(platform, url);
  const link = clip
    ? openLink(url, platform, clip.parts[p?.part ?? 0]?.start ?? clip.start)
    : null;
  const last = clips.length - 1;
  const hasPrev = idx > 0;
  const hasNext = idx < last;
  const nextHot = !!p?.ended && hasNext;

  const onBar = (e: GestureResponderEvent, width: number) => {
    if (width <= 0) return;
    go(seekPlayback(clips, pieces, e.nativeEvent.locationX / width));
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      z={57}
      maxHeight={0.94}
      style={{
        paddingHorizontal: 16,
        paddingBottom: Math.max(30, f.sheetBottom),
      }}
    >
      <Grabber mb={12} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            backgroundColor: C.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {platform && platform.key !== 'web' ? (
            <BrandLogo brand={platform.key} size={18} />
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T
            numberOfLines={1}
            style={sans(11, 700, C.ink3, {
              letterSpacing: 0.55,
              textTransform: 'uppercase',
            })}
          >
            {[platform?.name ?? tNow('clip.video'), r?.view.creator]
              .filter(Boolean)
              .join(' · ')}
          </T>
          <T
            numberOfLines={1}
            style={serif(19, 600, C.ink, { lineHeight: 23, marginTop: 1 })}
          >
            {clip
              ? tNow('clip.stepTitle', {
                  n: clip.step + 1,
                  title: step?.t ?? '',
                })
              : ''}
          </T>
        </View>
        <SheetClose onPress={close} />
      </View>

      <Pressable
        onPress={() => source && p && go(togglePlayback(clips, p), p.ended)}
        accessibilityRole="button"
        accessibilityLabel={p?.playing ? tr('clip.pause') : tr('clip.play')}
        style={{
          marginTop: 14,
          height: vertical ? 340 : 200,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: PLAYER_BG,
          alignItems: 'center',
        }}
      >
        <View style={{ height: '100%', width: vertical ? 192 : '100%' }}>
          {source ? (
            <View pointerEvents="none" style={{ flex: 1 }}>
              <ClipPlayer
                key={key}
                ref={drv}
                source={source}
                vertical={vertical}
                onTime={onTime}
                // The video itself ended inside a part: treat it as the part's end.
                onEnded={() => onTime(Number.MAX_SAFE_INTEGER)}
                onStatus={onStatus}
              />
            </View>
          ) : (
            <>
              <Stripes />
              <T
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  fontFamily: F.mono500,
                  fontSize: 11,
                  color: VIDEO_LABEL,
                }}
              >
                {tNow('clip.cantPlayHere')}
              </T>
            </>
          )}
        </View>
        {source ? <PlayDisc playing={!!p?.playing} ended={!!p?.ended} /> : null}
        {source && loading && p?.playing ? (
          <ActivityIndicator
            color={C.bg}
            style={{ position: 'absolute', top: '50%', marginTop: -10 }}
          />
        ) : null}
        <View
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            height: 26,
            paddingHorizontal: 10,
            borderRadius: 99,
            backgroundColor: 'rgba(25,28,25,.7)',
            justifyContent: 'center',
          }}
        >
          <T style={sans(12, 700, C.bg, NUMERIC)}>
            {`${clock(Math.floor(p?.pos ?? 0))} / ${clock(Math.floor(timelineEnd(clips, duration)))}`}
          </T>
        </View>
        {p?.ended ? (
          <View
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              height: 26,
              paddingHorizontal: 10,
              borderRadius: 99,
              backgroundColor: C.terraBright,
              justifyContent: 'center',
            }}
          >
            <T style={sans(12, 700, C.terraInk2)}>{tr('clip.endOfStep')}</T>
          </View>
        ) : null}
      </Pressable>

      <ClipBar
        segments={p ? barSegments(pieces, clip?.step ?? null, p.pos) : []}
        onSeek={onBar}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <T style={sans(12, 600, C.ink2, NUMERIC)}>
          {p ? playbackRange(clips, p) : ''}
        </T>
        <T style={sans(12, 600, C.ink2, NUMERIC)}>
          {p ? playbackLeft(clips, p) : ''}
        </T>
      </View>

      {step?.d ? (
        <T style={sans(15, 400, C.ink, { lineHeight: 22.5, marginTop: 12 })}>
          {step.d}
        </T>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Press
          onPress={() => p && go(moveTo(clips, p, -1))}
          scale={0.97}
          accessibilityLabel={tr('clip.previousStepClip')}
          style={{
            flex: 1,
            height: 46,
            borderWidth: 1.5,
            borderColor: C.line,
            borderRadius: 99,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: hasPrev ? 1 : 0.35,
          }}
        >
          <SkipPreviousIcon size={20} color={C.ink} />
          <T style={sans(14, 700, C.ink)}>{prevLabel(clips, idx)}</T>
        </Press>
        <Press
          onPress={() => go(startPlayback(clips, idx, true))}
          scale={0.92}
          accessibilityLabel={tr('clip.replayThisStep')}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: C.surface3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="replay" size={21} color={C.ink} />
        </Press>
        <Press
          onPress={() => p && go(moveTo(clips, p, 1))}
          scale={0.97}
          accessibilityLabel={tr('clip.nextStepClip')}
          style={{
            flex: 1,
            height: 46,
            borderRadius: 99,
            backgroundColor: nextHot ? C.green : C.surface3,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: hasNext ? 1 : 0.35,
          }}
        >
          <T style={sans(14, 700, nextHot ? C.bg : C.ink)}>
            {nextLabel(clips, idx)}
          </T>
          <SkipNextIcon size={20} color={nextHot ? C.bg : C.ink} />
        </Press>
      </View>

      {link ? (
        <Press
          onPress={() => {
            Linking.openURL(link.href).catch(() =>
              toast(tr('common.couldntOpenThatLink'), 'error'),
            );
          }}
          scale={0.97}
          accessibilityRole="link"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            marginTop: 14,
            paddingVertical: 4,
          }}
        >
          <T style={sans(13, 700, C.green)}>{link.label}</T>
          <OpenInNewIcon size={15} color={C.green} />
        </Press>
      ) : null}
    </Sheet>
  );
}

/** Dark diagonal-stripe placeholder where the video would be. */
function Stripes() {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
      <Defs>
        <Pattern
          id="clip-stripes"
          width={28}
          height={28}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Rect width={14} height={28} fill={STRIPE_A} />
          <Rect x={14} width={14} height={28} fill={STRIPE_B} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#clip-stripes)" />
    </Svg>
  );
}

/** Centre button: hidden while playing, a replay arrow once the clip has ended. */
function PlayDisc({ playing, ended }: { playing: boolean; ended: boolean }) {
  const a = useAnimatedStyle(() => ({
    opacity: tw(playing ? 0 : 1, 240),
    transform: [{ scale: tw(playing ? 0.8 : 1, 240) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 64,
          height: 64,
          marginLeft: -32,
          marginTop: -32,
          borderRadius: 32,
          backgroundColor: 'rgba(248,250,245,.92)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        a,
      ]}
    >
      <Glyph
        name={ended ? 'replay' : playing ? 'pause' : 'play_arrow'}
        size={36}
        color={C.ink}
        fill
      />
    </Animated.View>
  );
}

/**
 * The whole video split into chapters, like YouTube's: one segment per step part, faded
 * segments for video that belongs to no step, and the open step's parts raised in terracotta.
 * Tap to jump.
 */
function ClipBar({
  segments,
  onSeek,
}: {
  segments: BarSegmentProps[];
  onSeek: (e: GestureResponderEvent, width: number) => void;
}) {
  const tr = useT();
  const [w, setW] = useState(0);
  return (
    <Pressable
      onPress={(e) => onSeek(e, w)}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={tr('clip.stepClipsTapTo')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 26,
        marginTop: 10,
      }}
    >
      {segments.map((s, i) => (
        <BarSegment key={i} {...s} />
      ))}
    </Pressable>
  );
}

type BarSegmentProps = ReturnType<typeof barSegments>[number];

const SEGMENT_HEIGHT = { active: 7, step: 4, gap: 3 } as const;

function BarSegment({ flex, kind, fill }: BarSegmentProps) {
  const h = useAnimatedStyle(() => ({
    height: tw(SEGMENT_HEIGHT[kind], 200),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          flexGrow: flex,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          borderRadius: 3,
          backgroundColor: kind === 'active' ? C.terraSoft : C.line,
          opacity: kind === 'gap' ? 0.6 : 1,
          overflow: 'hidden',
        },
        h,
      ]}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.round(fill * 1000) / 10}%`,
          backgroundColor: kind === 'active' ? C.terra : C.ink3,
        }}
      />
    </Animated.View>
  );
}
