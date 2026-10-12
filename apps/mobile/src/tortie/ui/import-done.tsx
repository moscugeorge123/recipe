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

type DoneRecipe = {
  title: string;
  uri?: string | null;
  hue?: number;
  time: number;
  ingCount: number;
  stepCount: number;
};

/** Done state of an import: pop-in tile with sparkles, the saved recipe, Open recipe. */
export function ImportDone({
  recipe,
  recipeId,
  src,
  onOpen,
}: {
  recipe: DoneRecipe | null;
  recipeId: string | null;
  src?: ImportSrc;
  onOpen: () => void;
}) {
  const source = !src
    ? 'Scanned from a page'
    : src.kind === 'scan'
      ? 'Scanned from a page'
      : src.kind === 'web'
        ? 'From ' + src.host
        : 'From ' + src.name;
  return (
    <>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <View style={{ width: 120, height: 84, alignItems: 'center' }}>
          <Pop>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: C.greenSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name="check" size={40} color={C.green} />
            </View>
          </Pop>
          <Twinkle style={{ position: 'absolute', left: 6, top: 2 }}>
            <Glyph name="auto_awesome" size={18} color={C.terraBright} fill />
          </Twinkle>
          <Twinkle
            delay={500}
            style={{ position: 'absolute', right: 8, top: 14 }}
          >
            <Glyph name="auto_awesome" size={14} color={C.greenMid} fill />
          </Twinkle>
          <Twinkle
            delay={900}
            style={{ position: 'absolute', right: 20, bottom: 0 }}
          >
            <Glyph name="auto_awesome" size={12} color={C.terra} fill />
          </Twinkle>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 14,
          alignItems: 'center',
          marginTop: 12,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <Photo
          hue={recipe?.hue ?? hueOf(recipeId ?? 'import')}
          uri={recipe?.uri}
          radius={18}
          style={{ width: 72, height: 72 }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Glyph name="check_circle" size={16} color={C.green} fill />
            <T style={sans(12, 700, C.green)}>Added to Cookbook</T>
          </View>
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
      </View>
      <Press
        onPress={onOpen}
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
  );
}
