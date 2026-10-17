import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, SH } from '@/tortie/theme';
import { EmptyArt } from '@/tortie/ui/empty-state';
import { Glyph } from '@/tortie/ui/icon';
import { PulseDot } from '@/tortie/ui/keyframes';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

/** Camera · skillet · link cards fanned out: the three ways into the kitchen. */
export function KitchenMark({ scale = 1 }: { scale?: number }) {
  return <EmptyArt icons={KITCHEN_ICONS} scale={scale} />;
}

const KITCHEN_ICONS = ['photo_camera', 'skillet', 'link'] as const;

/**
 * The empty-library hero: one headline and one button that opens the Add
 * sheet (paste a link, scan a page or write one all live there).
 */
export function FirstRecipeHero({
  title = 'Add your first recipe',
  style,
}: {
  title?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.greenWash,
          borderWidth: 1,
          borderColor: C.greenSoft,
          borderRadius: 28,
          paddingTop: 24,
          paddingHorizontal: 20,
          paddingBottom: 20,
          alignItems: 'center',
        },
        style,
      ]}
    >
      <KitchenMark />
      <T
        accessibilityRole="header"
        style={[
          serif(26, 500),
          {
            letterSpacing: em(26, -0.02),
            marginTop: 16,
            textAlign: 'center',
          },
        ]}
      >
        {title}
      </T>
      <T
        style={[
          sans(14, 400, C.ink2),
          { lineHeight: 20, marginTop: 6, textAlign: 'center' },
        ]}
      >
        Paste a link and Tortie does the rest.
      </T>
      <Press
        onPress={() => useNav.getState().openAdd()}
        scale={0.96}
        easing={CSS_EASE}
        accessibilityLabel="Import a recipe"
        style={{
          alignSelf: 'stretch',
          marginTop: 20,
          height: 54,
          borderRadius: 99,
          backgroundColor: C.terra,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: SH.terraCta,
        }}
      >
        <Glyph name="download" size={21} color={C.white} />
        <T style={sans(15, 700, C.white)}>Import a recipe</T>
      </Press>
    </View>
  );
}

/**
 * Shown above the import state while the library is still unknown: a slow
 * first load, or an API that can't be reached. The import state stays usable
 * underneath, so the page is never blank.
 */
export function LibraryNotice({
  kind,
  onRetry,
  style,
}: {
  kind: 'slow' | 'unreachable';
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const slow = kind === 'slow';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 48,
          paddingVertical: 8,
          paddingLeft: 14,
          paddingRight: slow ? 14 : 6,
          borderRadius: 16,
          backgroundColor: C.surface2,
          borderWidth: 1,
          borderColor: C.line,
        },
        style,
      ]}
    >
      {slow ? (
        <PulseDot color={C.green} />
      ) : (
        <Glyph name="cloud_off" size={20} color={C.ink2} />
      )}
      <T style={[sans(13, 600, C.ink2), { flex: 1, lineHeight: 18 }]}>
        {slow
          ? 'Checking for your saved recipes…'
          : 'Couldn’t reach your saved recipes.'}
      </T>
      {slow ? null : (
        <Press
          onPress={onRetry}
          scale={0.94}
          easing={CSS_EASE}
          bg={C.white}
          pressedBg={C.surface3}
          style={{
            height: 36,
            paddingHorizontal: 14,
            borderRadius: 99,
            borderWidth: 1,
            borderColor: C.line,
            justifyContent: 'center',
          }}
        >
          <T style={sans(13, 700, C.green)}>Try again</T>
        </Press>
      )}
    </View>
  );
}
