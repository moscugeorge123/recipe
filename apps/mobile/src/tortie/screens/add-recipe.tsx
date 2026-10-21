import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { ImportErrorAction } from '@/features/extraction/error-groups';
import { useLinkPreview } from '@/features/link-preview/hooks/use-link-preview';
import { supportOf } from '@/features/share/sources';
import { PLATFORMS } from '@/features/share/url';
import { brandNameOf, runningJobs } from '@/features/extraction/import-jobs';
import { startImport, retryImport } from '@/tortie/data/import-engine';
import { useTRecipe } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { useImports } from '@/tortie/import-store';
import { afterMotion, openImportedRecipe, useNav } from '@/tortie/nav-store';
import { BASE_D, C, CSS_EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { BRAND_COLOR, BrandLogo, type Brand } from '@/tortie/ui/brand';
import { Grabber } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { ImportDone } from '@/tortie/ui/import-done';
import { ImportErrorCard } from '@/tortie/ui/import-error';
import { ImportProgress } from '@/tortie/ui/import-progress';
import { Input, RevealBox } from '@/tortie/ui/input';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { em, sans, serif, T } from '@/tortie/ui/text';

type Plat = { k: Brand; n: string; re: RegExp };
type Found = Plat | { k: 'web'; n: 'Website' };

/** The same platform list the share screen uses, so both recognise the same links. */
const PLATS: Plat[] = PLATFORMS.map((p) => ({
  k: p.kind,
  n: p.name,
  re: p.re,
}));
/** Only sources the importer really handles get a logo in the strip. */
const ADVERTISED = PLATS.filter((p) => supportOf(p.k) === 'supported');

/** A recognised platform the importer rejects (TikTok). */
const unsupportedPlat = (f: Found | null): Plat | null =>
  f && f.k !== 'web' && supportOf(f.k) === 'unsupported' ? f : null;

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

/** Sheet title and subtitle per step: idle · importing · done · failed. */
const HEADER: Record<0 | 1 | 2 | 3, readonly [string, string]> = {
  0: ['Add a recipe', 'From a link, a photo, or from scratch.'],
  1: ['Add a recipe', 'From a link, a photo, or from scratch.'],
  2: ['Recipe imported', 'Tap it to open, or import another.'],
  3: ['Import failed', 'Nothing was added to your Cookbook.'],
};

export function AddRecipeSheet() {
  const f = useFrame();
  const open = useNav((s) => s.addSheet);
  const cam = useNav((s) => s.cam);
  const focusId = useImports((s) => s.focusId);
  const job = useImports((s) => s.jobs.find((j) => j.id === focusId));
  const running = useImports((s) => runningJobs(s.jobs).length);
  const setFocus = useImports((s) => s.setFocus);

  const [url, setUrl] = useState('');
  const [clip, setClip] = useState<string | null>(null);
  const wasCam = useRef(false);

  /** 0 idle · 1 importing · 2 done · 3 failed — all derived from the focused job. */
  const imp = !job
    ? 0
    : job.status === 'running'
      ? 1
      : job.status === 'done'
        ? 2
        : 3;
  const impP = job?.pct ?? 0;
  const head =
    imp === 2 && job?.duplicate
      ? ([
          'Already in your cookbook',
          'Tap it to open, or import another.',
        ] as const)
      : HEADER[imp];

  const { r } = useTRecipe(job?.status === 'done' ? job.recipeId : null);
  const preview = useLinkPreview(imp === 1 ? job?.url : undefined);
  const previewThumb = preview.data?.thumbnails.find((t) =>
    /^https?:\/\//i.test(t.url),
  )?.url;

  // Opening again starts from a clean sheet, unless it was opened on a running
  // import (from Imports). Running imports carry on in the background
  // (Imports badge, floating pill), so another can start right away.
  useEffect(() => {
    if (!open) return;
    const { addJobId } = useNav.getState();
    useImports.getState().setFocus(addJobId);
    if (addJobId) useNav.setState({ addJobId: null });
    // Back from the camera the field is as the user left it. Any other open starts empty.
    if (!wasCam.current) {
      setUrl('');
      setClip(null);
    }
  }, [open]);

  // Closing for good clears the field and the clipboard suggestion too, once the sheet has
  // slid away, so a half-closed frame never loses its text. Going to the camera keeps them.
  useEffect(() => {
    if (open) return;
    const t = afterMotion(BASE_D * 1.2, () => {
      if (useNav.getState().cam) return;
      setUrl('');
      setClip(null);
    });
    return () => clearTimeout(t);
  }, [open]);

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

  const startImportFor = (raw?: string) => {
    const u = (raw ?? url).trim();
    const found = platOf(u);
    if (!found || unsupportedPlat(found)) return;
    // The suggestion is used up; whatever the user typed stays where it was.
    if (raw != null) setClip(null);
    setFocus(startImport(withScheme(u)));
  };

  const close = () => useNav.getState().closeAdd();
  const importAnother = () => {
    setUrl('');
    setFocus(null);
  };
  const openImported = () => {
    const id = job?.recipeId;
    useNav.getState().closeAdd();
    setUrl('');
    setClip(null);
    setFocus(null);
    if (id) openImportedRecipe(id, 260);
  };

  const onErrorAction = (action: ImportErrorAction) => {
    if (!job) return;
    switch (action) {
      case 'retry':
        setFocus(retryImport(job.id));
        break;
      case 'another':
        setUrl('');
        setFocus(null);
        break;
      case 'edit':
        setUrl(job.url);
        setFocus(null);
        break;
      case 'write':
        useNav.getState().openNewRecipe();
        break;
      case 'scan':
        useNav.getState().openCam();
        break;
    }
  };

  const pl = platOf(url);
  const cp = platOf(clip);
  const blockedPlat = unsupportedPlat(pl);
  const blocked = !!blockedPlat;
  const clipOn = !!cp && !unsupportedPlat(cp) && clip !== url && imp === 0;
  const brand = pl && pl.k !== 'web' ? pl.k : null;
  const bd = pl ? (brand ? BRAND_COLOR[brand] + '80' : '#32533c80') : C.line;
  const hint = blockedPlat
    ? blockedPlat.n +
      ' links can’t be imported yet. Try the creator’s recipe page.'
    : pl
      ? pl.k === 'web'
        ? 'Recipe site detected'
        : pl.n + ' detected'
      : 'Works with recipe sites and';
  const cta = blocked
    ? 'Not supported yet'
    : brand
      ? 'Import from ' + pl!.n
      : 'Import recipe';
  const field = useAnimatedStyle(() => ({
    borderColor: tw(bd, 250, CSS_EASE),
  }));
  const go = useAnimatedStyle(() => ({
    opacity: tw(pl && !blocked ? 1 : 0.4, 250, CSS_EASE),
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={[serif(26, 500), { letterSpacing: em(26, -0.01) }]}>
            {head[0]}
          </T>
          <T style={[sans(14, 400, C.ink2), { marginTop: 2 }]}>{head[1]}</T>
        </View>
        <ImportsButton running={running} />
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
                  paddingRight: 8,
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
                onSubmitEditing={() => startImportFor()}
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
              <T style={[sans(12, 600, C.ink2), { flexShrink: 1 }]}>{hint}</T>
              {blocked ? null : (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  {ADVERTISED.map((p) => (
                    <PlatLogo key={p.k} brand={p.k} on={!pl || pl.k === p.k} />
                  ))}
                </View>
              )}
            </View>
            <Press
              onPress={() => startImportFor()}
              disabled={!pl || blocked}
              scale={0.97}
              easing={CSS_EASE}
              accessibilityLabel={cta}
              accessibilityState={{ disabled: !pl || blocked }}
              animatedStyle={go}
              style={{
                height: 52,
                marginTop: 14,
                borderRadius: 99,
                backgroundColor: C.green,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <T style={sans(15, 700, C.bg)}>{cta}</T>
              <Glyph name="arrow_forward" size={20} color={C.bg} />
            </Press>
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
                onPress={() => clip && startImportFor(clip)}
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

      {imp === 1 && job ? (
        <ImportProgress
          pct={impP}
          recipe={null}
          src={job.src}
          url={job.url}
          title={preview.data?.title?.trim() || null}
          thumb={previewThumb}
          hint="Keep browsing — it’ll finish in the background"
        />
      ) : null}

      {imp === 1 ? (
        <Press
          onPress={importAnother}
          scale={0.97}
          easing={CSS_EASE}
          accessibilityLabel="Import another recipe"
          style={{
            height: 50,
            marginTop: 14,
            borderRadius: 99,
            borderWidth: 1.5,
            borderColor: C.line,
            backgroundColor: C.white,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Glyph name="add_link" size={20} color={C.green} />
          <T style={sans(15, 600)}>Import another recipe</T>
        </Press>
      ) : null}

      {imp === 2 && job ? (
        <ImportDone
          recipe={
            r
              ? { ...r }
              : job.title
                ? {
                    title: job.title,
                    uri: job.thumb,
                    time: 0,
                    ingCount: 0,
                    stepCount: 0,
                  }
                : null
          }
          recipeId={job.recipeId ?? null}
          duplicate={job.duplicate}
          src={job.src}
          onOpen={openImported}
          onAnother={importAnother}
        />
      ) : null}

      {imp === 3 && job ? (
        <ImportErrorCard
          group={job.group ?? 'generic'}
          source={brandNameOf(job.src)}
          scan={job.src.kind === 'scan'}
          retryAt={job.retryAt}
          onAction={onErrorAction}
        />
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

/** Header button: opens the Imports screen; the badge counts running imports. */
function ImportsButton({ running }: { running: number }) {
  return (
    <Press
      onPress={() => useNav.getState().openImports()}
      scale={0.95}
      easing={CSS_EASE}
      accessibilityLabel={
        running ? `Imports, ${running} in progress` : 'Imports'
      }
      style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingLeft: 10,
        paddingRight: running ? 6 : 12,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.white,
      }}
    >
      <Glyph name="history" size={18} color={C.ink2} />
      <T style={sans(13, 600)}>Imports</T>
      {running ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
            borderRadius: 10,
            backgroundColor: C.terra,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(11, 700, C.white)}>{running}</T>
        </View>
      ) : null}
    </Press>
  );
}
