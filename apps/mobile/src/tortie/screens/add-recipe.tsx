import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useCreateExtraction } from '@/features/extraction/hooks/use-create-extraction';
import { useExtractionJob } from '@/features/extraction/hooks/use-extraction-job';
import { errorCodeOf, importFailureToast } from '@/lib/user-error';
import { hueOf } from '@/tortie/color';
import { useTRecipe } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { fmtT, plz } from '@/tortie/lib/fmt';
import { afterMotion, toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { BRAND_COLOR, BrandLogo, type Brand } from '@/tortie/ui/brand';
import { Grabber } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { ImportProgress } from '@/tortie/ui/import-progress';
import { Input, RevealBox } from '@/tortie/ui/input';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { em, sans, serif, T } from '@/tortie/ui/text';

type Plat = { k: Brand; n: string; re: RegExp };
type Found = Plat | { k: 'web'; n: 'Website' };

const PLATS: Plat[] = [
  { k: 'instagram', n: 'Instagram', re: /instagram\.com|instagr\.am/i },
  { k: 'tiktok', n: 'TikTok', re: /tiktok\.com/i },
  { k: 'youtube', n: 'YouTube', re: /youtube\.com|youtu\.be/i },
  { k: 'pinterest', n: 'Pinterest', re: /pinterest\.|pin\.it/i },
  { k: 'facebook', n: 'Facebook', re: /facebook\.com|fb\.watch/i },
];

function platOf(raw: string | null | undefined): Found | null {
  const u = (raw ?? '').trim();
  if (!u) return null;
  const p = PLATS.find((x) => x.re.test(u));
  if (p) return p;
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/|$)/i.test(u)
    ? { k: 'web', n: 'Website' }
    : null;
}

const urlIn = (t: string | null | undefined) =>
  (t ?? '').match(/https?:\/\/[^\s]+/i)?.[0] ?? null;
const bare = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '');
const withScheme = (u: string) =>
  /^https?:\/\//i.test(u) ? u : 'https://' + u;

/** 0 idle · 1 importing · 2 done. */
type Imp = 0 | 1 | 2;

export function AddRecipeSheet() {
  const f = useFrame();
  const open = useNav((s) => s.addSheet);
  const cam = useNav((s) => s.cam);
  const create = useCreateExtraction();

  const [url, setUrl] = useState('');
  const [clip, setClip] = useState<string | null>(null);
  const [imp, setImp] = useState<Imp>(0);
  const [impP, setImpP] = useState(0);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const t0 = useRef(0);
  const jobRef = useRef<string | null>(null);
  const polled = useRef({
    id: null as string | null,
    progress: 0,
    status: '',
    recipeId: null as string | null,
    error: false,
    errorCode: undefined as string | undefined,
  });
  const srcName = useRef<string | undefined>(undefined);
  const wasCam = useRef(false);

  const job = useExtractionJob(jobId);
  const { r } = useTRecipe(recipeId);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && imp === 2) {
      setImp(0);
      setImpP(0);
    }
  }

  useEffect(() => {
    if (!open) {
      wasCam.current = cam;
      return;
    }
    if (wasCam.current) {
      wasCam.current = false;
      return;
    }
    let live = true;
    Clipboard.getStringAsync()
      .then((t) => live && setClip(urlIn(t)))
      .catch(() => live && setClip(null));
    return () => {
      live = false;
    };
  }, [open, cam]);

  const fail = (msg: string) => {
    jobRef.current = null;
    setImp(0);
    setImpP(0);
    setJobId(undefined);
    toast(msg);
  };

  useEffect(() => {
    polled.current = {
      id: job.job?.id ?? null,
      progress: job.job?.progress ?? 0,
      status: job.job?.status ?? '',
      recipeId: job.job?.recipeId ?? null,
      error: job.isError,
      errorCode: errorCodeOf(job.job?.error),
    };
  }, [job.job, job.isError]);

  // Real progress arrives every few seconds; the bar keeps the prototype's +2.4 / 50ms pace and never goes back.
  useEffect(() => {
    if (imp !== 1) return;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    let finished = false;
    const iv = setInterval(() => {
      const L = polled.current;
      const mine = !!jobRef.current && L.id === jobRef.current;
      if (mine || (jobRef.current && L.error)) {
        if (
          L.error ||
          L.status === 'FAILED' ||
          L.status === 'CANCELLED' ||
          (L.status === 'COMPLETED' && !L.recipeId)
        ) {
          clearInterval(iv);
          fail(
            L.error
              ? 'Lost track of that import — try again'
              : L.status === 'CANCELLED'
                ? 'Import cancelled'
                : importFailureToast(L.errorCode, srcName.current),
          );
          return;
        }
        if (L.status === 'COMPLETED' && L.recipeId && !finished) {
          finished = true;
          setRecipeId(L.recipeId);
        }
      }
      const t = Date.now() - t0.current;
      const creep = 94 * (1 - Math.exp(-t / 9000));
      const target = finished
        ? 100
        : Math.min(94, Math.max(mine ? L.progress : 0, creep));
      setImpP((p) => {
        const n = Math.min(Math.max(p, target), p + 2.4, 100);
        if (n >= 100 && !doneT) {
          clearInterval(iv);
          doneT = setTimeout(() => setImp(2), 300);
        }
        return n;
      });
    }, 50);
    return () => {
      clearInterval(iv);
      if (doneT) clearTimeout(doneT);
    };
  }, [imp]);

  const startImport = (raw?: string) => {
    const u = (raw ?? url).trim();
    const found = platOf(u);
    if (!found) return;
    srcName.current = found.k === 'web' ? undefined : found.n;
    if (raw != null) setUrl(raw);
    t0.current = Date.now();
    jobRef.current = null;
    setImp(1);
    setImpP(0);
    setRecipeId(null);
    setJobId(undefined);
    create.mutate(
      { url: withScheme(u) },
      {
        onSuccess: (res) => {
          if (
            res.recipeId &&
            (res.deduplicated || res.status === 'completed')
          ) {
            setRecipeId(res.recipeId);
            setImpP(100);
            setImp(2);
            return;
          }
          jobRef.current = res.jobId;
          setJobId(res.jobId);
        },
        onError: (e) =>
          fail(
            importFailureToast(
              errorCodeOf(e),
              srcName.current,
              'Couldn’t start that import — check the link and try again',
            ),
          ),
      },
    );
  };

  const close = () => useNav.getState().closeAdd();
  const openImported = () => {
    const id = recipeId;
    useNav.getState().closeAdd();
    setImp(0);
    setImpP(0);
    setUrl('');
    setClip(null);
    setJobId(undefined);
    jobRef.current = null;
    if (id) afterMotion(260, () => useNav.getState().openRecipe(id));
  };

  const pl = platOf(url);
  const cp = platOf(clip);
  const clipOn = !!cp && clip !== url && imp === 0;
  const brand = pl && pl.k !== 'web' ? pl.k : null;
  const bd = pl ? (brand ? BRAND_COLOR[brand] + '80' : '#32533c80') : C.line;
  const hint = pl
    ? pl.k === 'web'
      ? 'Recipe site detected'
      : pl.n + ' detected'
    : 'Works with recipe sites and';
  const cta = brand ? 'Import from ' + pl!.n : 'Import recipe';
  const srcTxt = pl
    ? pl.k === 'web'
      ? 'From ' + bare(url).split('/')[0]
      : 'From ' + pl.n
    : 'Scanned from a page';

  const field = useAnimatedStyle(() => ({
    borderColor: tw(bd, 250, CSS_EASE),
  }));
  const go = useAnimatedStyle(() => ({
    opacity: tw(pl ? 1 : 0.4, 250, CSS_EASE),
  }));

  return (
    <Sheet
      open={open}
      onClose={close}
      z={40}
      avoidKeyboard
      style={{ paddingBottom: Math.max(36, f.sheetBottom) }}
    >
      <Grabber />
      <View>
        <T style={[serif(26, 500), { letterSpacing: em(26, -0.01) }]}>
          Add a recipe
        </T>
        <T style={[sans(14, 400, C.ink2), { marginTop: 2 }]}>
          From a link, a photo, or from scratch.
        </T>
      </View>

      {imp === 0 ? (
        <>
          <RevealBox>
            <Animated.View
              style={[
                {
                  marginTop: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  height: 56,
                  paddingLeft: 16,
                  paddingRight: 6,
                  backgroundColor: C.white,
                  borderWidth: 1.5,
                  borderRadius: 99,
                },
                field,
              ]}
            >
              {brand ? (
                <BrandLogo brand={brand} size={20} />
              ) : pl ? (
                <Glyph name="language" size={21} color={C.green} />
              ) : (
                <Glyph name="link" size={21} color="#727971" />
              )}
              <Input
                value={url}
                onChangeText={setUrl}
                onSubmitEditing={() => startImport()}
                placeholder="Paste a recipe link"
                placeholderTextColor={C.ink3}
                inputMode="url"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                allowFontScaling={false}
                style={[
                  sans(15, 400),
                  { flex: 1, minWidth: 0, height: '100%', padding: 0 },
                  { outlineStyle: 'none' } as object,
                ]}
              />
              {url ? (
                <Press
                  onPress={() => setUrl('')}
                  accessibilityLabel="Clear link"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Glyph name="close" size={18} color="#727971" />
                </Press>
              ) : null}
              <Press
                onPress={() => startImport()}
                disabled={!pl}
                scale={0.92}
                easing={CSS_EASE}
                accessibilityLabel={cta}
                animatedStyle={go}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: C.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="arrow_forward" size={22} color={C.bg} />
              </Press>
            </Animated.View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                paddingHorizontal: 16,
              }}
            >
              <T style={sans(12, 600, C.ink2)}>{hint}</T>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {PLATS.map((p) => (
                  <PlatLogo key={p.k} brand={p.k} on={!pl || pl.k === p.k} />
                ))}
              </View>
            </View>
          </RevealBox>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 22,
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
            <T style={sans(12, 600, '#727971')}>or</T>
            <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
          </View>
          <View
            style={{
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            <OptionRow
              icon="photo_camera"
              title="Scan a page"
              sub="Cookbook or handwritten card"
              onPress={() => useNav.getState().openCam()}
            />
            <View
              style={{ height: 1, backgroundColor: C.surface3, marginLeft: 68 }}
            />
            <OptionRow
              icon="edit"
              title="Write it yourself"
              sub="Blank page — Tortie can draft it with you"
              onPress={() => useNav.getState().openNewRecipe()}
            />
          </View>
          {clipOn && cp ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginTop: 12,
                paddingVertical: 10,
                paddingLeft: 14,
                paddingRight: 8,
                backgroundColor: '#eef2ec',
                borderRadius: 20,
              }}
            >
              {cp.k !== 'web' ? (
                <BrandLogo brand={cp.k} size={22} />
              ) : (
                <Glyph name="language" size={22} color={C.green} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={sans(13, 700, C.green)}>
                  {'Detected ' +
                    (cp.k === 'web' ? 'recipe site' : cp.n) +
                    ' link'}
                </T>
                <T
                  numberOfLines={1}
                  style={[sans(12, 400, C.ink2), { marginTop: 1 }]}
                >
                  {bare(clip ?? '')}
                </T>
              </View>
              <Press
                onPress={() => clip && startImport(clip)}
                scale={0.94}
                easing={CSS_EASE}
                style={{
                  height: 36,
                  paddingHorizontal: 16,
                  flexShrink: 0,
                  borderRadius: 99,
                  backgroundColor: C.green,
                  justifyContent: 'center',
                }}
              >
                <T style={sans(13, 700, C.bg)}>Import</T>
              </Press>
            </View>
          ) : null}
        </>
      ) : null}

      {imp === 1 ? <ImportProgress pct={impP} recipe={r} /> : null}

      {imp === 2 ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              gap: 14,
              alignItems: 'center',
              marginTop: 20,
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <Photo
              hue={r?.hue ?? hueOf(recipeId ?? 'import')}
              uri={r?.uri}
              radius={18}
              style={{ width: 72, height: 72 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Glyph name="check_circle" size={16} color={C.green} fill />
                <T style={sans(12, 700, C.green)}>Saved to Cookbook</T>
              </View>
              <T numberOfLines={2} style={[serif(19, 600), { marginTop: 3 }]}>
                {r?.title ?? ''}
              </T>
              <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
                {r
                  ? [
                      r.time ? fmtT(r.time) : '',
                      plz(r.ingCount, 'ingredient'),
                      plz(r.stepCount, 'step'),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : ''}
              </T>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 4,
                }}
              >
                {brand ? <BrandLogo brand={brand} size={13} /> : null}
                <T
                  numberOfLines={1}
                  style={[sans(12, 400, C.ink2), { flexShrink: 1 }]}
                >
                  {srcTxt}
                </T>
              </View>
            </View>
          </View>
          <Press
            onPress={openImported}
            scale={0.97}
            easing={CSS_EASE}
            style={{
              height: 54,
              marginTop: 16,
              borderRadius: 99,
              backgroundColor: C.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(15, 700, C.bg)}>Open recipe</T>
          </Press>
        </>
      ) : null}
    </Sheet>
  );
}

function PlatLogo({ brand, on }: { brand: Brand; on: boolean }) {
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0.3, 250, CSS_EASE),
  }));
  return (
    <Animated.View style={a}>
      <BrandLogo brand={brand} size={14} />
    </Animated.View>
  );
}

function OptionRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      bg="transparent"
      pressedBg={C.surface2}
      easing={CSS_EASE}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: '#eef2ec',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name={icon} size={21} color={C.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={sans(15, 600)}>{title}</T>
        <T style={[sans(12, 400, C.ink2), { marginTop: 1 }]}>{sub}</T>
      </View>
      <Glyph name="chevron_right" size={20} color="#727971" />
    </Press>
  );
}
