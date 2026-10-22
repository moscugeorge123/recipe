import { View } from 'react-native';

import type { ImportSrc } from '@/features/extraction/import-jobs';
import { hueOf } from '@/tortie/color';
import { fmtT, plz } from '@/tortie/lib/fmt';
import { C, CSS_EASE } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { SourceGlyph } from '@/tortie/ui/import-progress';
import { Pop, Twinkle } from '@/tortie/ui/keyframes';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { sans, serif, T } from '@/tortie/ui/text';
import { useT } from '@/i18n';
import { tNow } from '@/i18n/format';

type DoneRecipe = {
  title: string;
  uri?: string | null;
  hue?: number;
  time: number;
  ingCount: number;
  stepCount: number;
};

/**
 * Done state of an import: the saved recipe as one tappable card (a check badge
 * pops in on its photo), and a button to start the next import.
 */
export function ImportDone({
  recipe,
  recipeId,
  duplicate = false,
  src,
  onOpen,
  onAnother,
}: {
  recipe: DoneRecipe | null;
  recipeId: string | null;
  /** The link was already in the Cookbook. */
  duplicate?: boolean;
  src?: ImportSrc;
  onOpen: () => void;
  onAnother: () => void;
}) {
  const t = useT();
  const source = !src
    ? tNow('imports.scannedFromPage')
    : src.kind === 'scan'
      ? tNow('imports.scannedFromPage')
      : src.kind === 'web'
        ? tNow('import.sourceHost', { source: src.host })
        : tNow('import.sourceHost', { source: src.name });
  return (
    <>
      <Press
        onPress={onOpen}
        scale={0.98}
        easing={CSS_EASE}
        accessibilityLabel={tNow('imports.openJob', {
          title: recipe?.title ?? tNow('imports.recipeFallback'),
        })}
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
        <View style={{ width: 84, height: 84 }}>
          <Photo
            hue={recipe?.hue ?? hueOf(recipeId ?? 'import')}
            uri={recipe?.uri}
            radius={18}
            style={{ width: 84, height: 84 }}
          />
          <Pop style={{ position: 'absolute', right: -8, bottom: -8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: C.green,
                borderWidth: 2.5,
                borderColor: C.white,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name="check" size={16} color={C.white} />
            </View>
          </Pop>
          <Twinkle style={{ position: 'absolute', right: -14, top: -8 }}>
            <Glyph name="auto_awesome" size={16} color={C.terraBright} fill />
          </Twinkle>
          <Twinkle
            delay={600}
            style={{ position: 'absolute', left: -8, bottom: 14 }}
          >
            <Glyph name="auto_awesome" size={12} color={C.greenMid} fill />
          </Twinkle>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(12, 700, C.green)}>
            {duplicate
              ? t('imports.alreadyInYourCookbook')
              : t('imports.addedToCookbook')}
          </T>
          <T numberOfLines={2} style={[serif(19, 600), { marginTop: 3 }]}>
            {recipe?.title ?? ''}
          </T>
          <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
            {recipe
              ? [
                  recipe.time ? fmtT(recipe.time) : '',
                  plz(recipe.ingCount, 'ingredient'),
                  plz(recipe.stepCount, 'step'),
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
            {src ? <SourceGlyph src={src} size={13} /> : null}
            <T
              numberOfLines={1}
              style={[sans(12, 400, C.ink2), { flexShrink: 1 }]}
            >
              {source}
            </T>
          </View>
        </View>
        <Glyph name="chevron_right" size={20} color={C.ink3} />
      </Press>
      <Press
        onPress={onAnother}
        scale={0.97}
        easing={CSS_EASE}
        style={{
          height: 54,
          marginTop: 16,
          borderRadius: 99,
          backgroundColor: C.green,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Glyph name="add_link" size={20} color={C.bg} />
        <T style={sans(15, 700, C.bg)}>{t('common.importAnotherRecipe')}</T>
      </Press>
    </>
  );
}
