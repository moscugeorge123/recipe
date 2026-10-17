import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { useLinkPreview } from '@/features/link-preview/hooks/use-link-preview';
import { supportOf, unsupportedSourceNote } from '@/features/share/sources';
import { useSharedImport } from '@/features/share/use-shared-import';
import {
  hostOf,
  sourceFromPreview,
  sourceOf,
  type LinkSource,
} from '@/features/share/url';
import { hueOf } from '@/tortie/color';
import { useFrame } from '@/tortie/frame';
import { fmtT, plz } from '@/tortie/lib/fmt';
import { openImportedRecipe, useNav } from '@/tortie/nav-store';
import { BASE_D, C, CSS_EASE, F, SH } from '@/tortie/theme';
import { BrandLogo } from '@/tortie/ui/brand';
import { Glyph } from '@/tortie/ui/icon';
import { ImportProgress } from '@/tortie/ui/import-progress';
import { Dots } from '@/tortie/ui/keyframes';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const FROST = 'rgba(248,250,245,.92)';

export function SharePreview() {
  const open = useNav((s) => s.shareOpen);
  const url = useNav((s) => s.shareUrl);
  const hinted = useNav((s) => s.shareTitle);
  const f = useFrame();
  const preview = useLinkPreview(open ? (url ?? undefined) : undefined);
  const imp = useSharedImport();
  const [dock, setDock] = useState(120);
  // "Import anyway" on a page that does not look like a recipe, remembered per link.
  const [anywayFor, setAnywayFor] = useState<string | null>(null);

  if (!url) return null;

  const fromUrl = sourceOf(url);
  const fromPreview = preview.data
    ? sourceFromPreview(preview.data.sourceType)
    : null;
  const source =
    fromPreview && fromPreview.kind !== 'web'
      ? fromPreview
      : (fromUrl ?? fromPreview);
  const host = hostOf(url);
  const brand = source && source.kind !== 'web' ? source.kind : null;
  // TikTok and Facebook show a login wall to the preview fetcher, so its title ("TikTok -
  // Make Your Day") says nothing about the link. Show only the source and the domain.
  const blocked = brand && supportOf(brand) === 'unsupported' ? source : null;
  const fetchedTitle = blocked ? '' : preview.data?.title?.trim() || '';
  const hintedTitle = blocked ? '' : hinted?.trim() || '';
  // A platform page with no title of its own gets a note instead of its hostname as a title.
  const title = fetchedTitle || hintedTitle || (brand ? '' : host);
  const author = blocked ? null : preview.data?.author?.trim() || null;
  const description = blocked
    ? null
    : preview.data?.description?.trim() || null;
  const thumb = blocked
    ? undefined
    : preview.data?.thumbnails.find((item) => /^https?:\/\//i.test(item.url))
        ?.url;
  const hue = hueOf(url);
  const reading = preview.isFetching && !preview.data;
  const noPreview =
    !blocked &&
    !!brand &&
    !title &&
    !description &&
    !reading &&
    !preview.isError;
  const notRecipe =
    !blocked && preview.data?.looksLikeRecipe === false && anywayFor !== url;
  const cta = brand ? 'Import from ' + source!.name : 'Import recipe';
  const barPad = Math.max(30, f.bottom);

  const close = () => useNav.getState().closeShare();
  const start = () => imp.start(url, { thumbnail: thumb });
  const openImported = () => {
    const id = imp.recipeId;
    useNav.getState().closeShare();
    if (id) openImportedRecipe(id, Math.round(BASE_D * 1.1));
  };

  return (
    <>
      <ScrollView
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        contentContainerStyle={{ paddingBottom: dock + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Photo
          hue={hue}
          uri={thumb}
          caption={thumb ? undefined : 'link · ' + host}
          captionSize={11}
          captionStyle={{ left: 20, bottom: 46 }}
          style={{ height: 300 }}
        />
        <View
          style={{
            marginTop: -30,
            backgroundColor: C.bg,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingTop: 22,
            paddingHorizontal: 20,
          }}
        >
          {source ? <SourceChip source={source} /> : null}
          {title ? (
            <T
              numberOfLines={4}
              style={serif(31, 500, C.ink, {
                lineHeight: 34.72,
                letterSpacing: em(31, -0.02),
                marginTop: 12,
              })}
            >
              {title}
            </T>
          ) : null}
          {author ? (
            <T style={[sans(14, 500, C.ink2), { marginTop: 6 }]}>{author}</T>
          ) : null}
          {imp.phase === 1 && imp.job ? (
            <ImportProgress
              pct={imp.pct}
              recipe={null}
              src={imp.job.src}
              url={url}
              title={title}
              thumb={thumb}
              style={{ marginTop: 16 }}
            />
          ) : reading ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 12,
                minHeight: 22,
              }}
            >
              <T style={sans(15, 600, C.ink2)}>Reading the link</T>
              <Dots textStyle={sans(15, 600, C.ink2)} />
            </View>
          ) : description ? (
            <T
              numberOfLines={6}
              style={{
                fontFamily: F.serif400i,
                fontSize: 17,
                lineHeight: 25.5,
                color: C.ink2,
                marginTop: 12,
              }}
            >
              {description}
            </T>
          ) : preview.isError ? (
            <T style={[sans(14, 500, C.ink3), { marginTop: 12 }]}>
              Couldn’t load a preview. You can still import it.
            </T>
          ) : null}
          {noPreview ? (
            <T style={[sans(14, 500, C.ink3), { marginTop: 12 }]}>
              Preview not available. You can still import it.
            </T>
          ) : null}
          {blocked ? (
            <Notice
              icon="link_off"
              text={unsupportedSourceNote(blocked.name)}
              style={{ marginTop: 16 }}
            />
          ) : null}
          {notRecipe && imp.phase === 0 ? (
            <Notice
              icon="no_meals"
              text="This doesn’t look like a recipe. You can still try importing it."
              style={{ marginTop: 16 }}
            />
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
            }}
          >
            <Glyph name="link" size={16} color={C.ink3} />
            <T numberOfLines={1} style={[sans(13, 500, C.ink3), { flex: 1 }]}>
              {host}
            </T>
          </View>
        </View>
      </ScrollView>

      <Press
        onPress={close}
        accessibilityLabel="Close"
        scale={0.9}
        ms={200}
        easing={CSS_EASE}
        style={{
          position: 'absolute',
          top: f.pushTop,
          left: 16,
          width: 42,
          height: 42,
          borderRadius: 21,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BlurView
          intensity={20}
          tint="light"
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: FROST,
          }}
        />
        <Glyph name="arrow_back" size={24} color={C.ink} />
      </Press>

      <View
        onLayout={(e) => setDock(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 14,
          paddingHorizontal: 20,
          paddingBottom: barPad,
        }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(248,250,245,0)', C.bg, C.bg]}
          locations={[0, 0.36, 1]}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        />
        {imp.phase === 0 && blocked ? (
          <ImportButton label="Not supported yet" onPress={close} disabled />
        ) : null}
        {imp.phase === 0 && !blocked && notRecipe ? (
          <OutlineButton
            label="Import anyway"
            onPress={() => setAnywayFor(url)}
          />
        ) : null}
        {imp.phase === 0 && !blocked && !notRecipe ? (
          <ImportButton label={cta} onPress={start} />
        ) : null}
        {imp.phase === 1 ? (
          <Press
            onPress={imp.cancel}
            scale={0.96}
            easing={CSS_EASE}
            accessibilityLabel="Cancel import"
            style={{
              height: 48,
              borderRadius: 99,
              borderWidth: 1.5,
              borderColor: C.line,
              backgroundColor: C.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(15, 600)}>Cancel</T>
          </Press>
        ) : null}
        {imp.phase === 2 ? (
          <SavedDock
            duplicate={imp.job?.duplicate}
            title={imp.recipe?.title}
            meta={
              imp.recipe
                ? [
                    imp.recipe.time ? fmtT(imp.recipe.time) : '',
                    plz(imp.recipe.ingCount, 'ingredient'),
                    plz(imp.recipe.stepCount, 'step'),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
            onOpen={openImported}
          />
        ) : null}
      </View>
    </>
  );
}

function SourceChip({ source }: { source: LinkSource }) {
  const brand = source.kind !== 'web' ? source.kind : null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.greenSoft,
        paddingVertical: 5,
        paddingLeft: brand ? 8 : 12,
        paddingRight: 12,
        borderRadius: 99,
      }}
    >
      {brand ? (
        <BrandLogo brand={brand} size={14} />
      ) : (
        <Glyph name="language" size={14} color={C.green} />
      )}
      <T style={sans(12, 700, C.green)}>{source.name}</T>
    </View>
  );
}

function Notice({
  icon,
  text,
  style,
}: {
  icon: string;
  text: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          padding: 14,
          borderRadius: 16,
          backgroundColor: C.surface3,
        },
        style,
      ]}
    >
      <Glyph name={icon} size={20} color={C.ink2} />
      <T style={[sans(14, 500, C.ink2), { flex: 1 }]}>{text}</T>
    </View>
  );
}

function OutlineButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.97}
      easing={CSS_EASE}
      accessibilityLabel={label}
      style={{
        height: 56,
        borderRadius: 99,
        borderWidth: 1.5,
        borderColor: C.line,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T style={sans(16, 600)}>{label}</T>
    </Press>
  );
}

function ImportButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      scale={0.97}
      ms={220}
      easing={CSS_EASE}
      accessibilityLabel={label}
      style={{
        height: 56,
        borderRadius: 99,
        backgroundColor: C.green,
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: SH.greenCta,
      }}
    >
      <T style={sans(16, 700, C.bg)}>{label}</T>
    </Press>
  );
}

function SavedDock({
  title,
  meta,
  duplicate,
  onOpen,
}: {
  duplicate?: boolean;
  title?: string;
  meta: string | null;
  onOpen: () => void;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Glyph name="check_circle" size={18} color={C.green} fill />
        <T style={sans(13, 700, C.green)}>
          {duplicate ? 'Already in your cookbook' : 'Saved to Cookbook'}
        </T>
      </View>
      {title ? (
        <T numberOfLines={1} style={[serif(20, 600), { marginTop: 4 }]}>
          {title}
        </T>
      ) : null}
      {meta ? (
        <T style={[sans(12, 500, C.ink2), { marginTop: 2 }]}>{meta}</T>
      ) : null}
      <Press
        onPress={onOpen}
        scale={0.97}
        easing={CSS_EASE}
        accessibilityLabel="Open recipe"
        style={{
          height: 56,
          marginTop: 14,
          borderRadius: 99,
          backgroundColor: C.green,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: SH.greenCta,
        }}
      >
        <T style={sans(16, 700, C.bg)}>Open recipe</T>
      </Press>
    </View>
  );
}
