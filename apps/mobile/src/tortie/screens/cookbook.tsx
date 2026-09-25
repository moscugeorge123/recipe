import { memo, useCallback, type ReactNode } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  collName,
  FILTERS,
  useCookbook,
  useCookbookView,
  type BookItem,
  type CollItem,
  type CollTile,
} from '@/tortie/data/cookbook';
import type { TRecipe } from '@/tortie/data/recipes';
import { useToggleSave } from '@/tortie/data/saved';
import { useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, F } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { BookmarkButton, Pill, Segmented } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { Stagger } from '@/tortie/ui/stagger';
import { TabScroll } from '@/tortie/ui/tab-scroll';
import { iconText } from '@/tortie/ui/icon-text';
import { ctl, sans, serif, T } from '@/tortie/ui/text';

export function CookbookScreen() {
  const on = useNav((s) => s.tab === 'cookbook' && s.mounted);
  const v = useCookbookView();
  const cbSeg = useCookbook((s) => s.cbSeg);
  const cbFade = useCookbook((s) => s.cbFade);
  const isC = cbSeg === 'collections';
  const sub = isC
    ? `${v.nColls} collections · 0 shared`
    : `${v.nAll} recipes · ${v.nSaved} saved`;

  const fx = useAnimatedStyle(() => ({
    opacity: tw(cbFade ? 0 : 1, 160, CSS_EASE),
    transform: [{ translateY: tw(cbFade ? 8 : 0, 220, EASE) }],
  }));

  return (
    <TabScroll
      header={(compact) => (
        <CookbookHeader compact={compact} on={on} sub={sub} />
      )}
    >
      <Stagger i={1} on={on}>
        <Segmented
          style={{ marginBottom: 12 }}
          index={isC ? 1 : 0}
          items={[
            {
              label: 'Recipes',
              badge: String(v.nAll),
              onPress: () => useCookbook.getState().setCbSeg('recipes'),
            },
            {
              label: 'Collections',
              badge: String(v.nColls),
              onPress: () => useCookbook.getState().goCollections(),
            },
          ]}
        />
      </Stagger>
      <Stagger i={2} on={on}>
        <SearchBar isC={isC} count={v.aCnt} />
      </Stagger>
      <Animated.View style={fx}>
        {isC ? (
          <CollectionsView colls={v.colls} on={on} loading={v.collsLoading} />
        ) : (
          <RecipesView
            book={v.book}
            on={on}
            nSaved={v.nSaved}
            collName={v.collO ? collName(v.collO).n : null}
            loading={v.recipesLoading}
          />
        )}
      </Animated.View>
    </TabScroll>
  );
}

/** Sticky title: 36 → 20, padding `8 0 16` → `10 0 10`, subtitle collapses (220ms ease). */
function CookbookHeader({
  compact,
  on,
  sub,
}: {
  compact: boolean;
  on: boolean;
  sub: string;
}) {
  const pad = useAnimatedStyle(() => ({
    paddingTop: tw(compact ? 10 : 8, 220, CSS_EASE),
    paddingBottom: tw(compact ? 10 : 16, 220, CSS_EASE),
  }));
  const title = useAnimatedStyle(() => ({
    fontSize: tw(compact ? 20 : 36, 220, CSS_EASE),
    lineHeight: tw(compact ? 22 : 39.6, 220, CSS_EASE),
    letterSpacing: tw(compact ? -0.4 : -0.72, 220, CSS_EASE),
  }));
  const subBox = useAnimatedStyle(() => ({
    height: tw(compact ? 0 : 20, 220, CSS_EASE),
    marginTop: tw(compact ? 0 : 4, 220, CSS_EASE),
    opacity: tw(compact ? 0 : 1, 200, CSS_EASE),
  }));
  return (
    <Stagger i={0} on={on}>
      <Animated.View style={pad}>
        <Animated.Text
          allowFontScaling={false}
          style={[{ fontFamily: F.serif500, color: C.ink }, title]}
        >
          Cookbook
        </Animated.Text>
        <Animated.View style={[{ overflow: 'hidden' }, subBox]}>
          <T style={sans(14, 400, C.ink2, { lineHeight: 20 })}>{sub}</T>
        </Animated.View>
      </Animated.View>
    </Stagger>
  );
}

function SearchBar({ isC, count }: { isC: boolean; count: number }) {
  const q = useCookbook((s) => s.q);
  const setQ = useCookbook((s) => s.setQ);
  const has = count > 0;
  const tuneBg = useAnimatedStyle(() => ({
    backgroundColor: tw(has ? C.green : 'rgba(50,83,60,0)', 240, CSS_EASE),
  }));
  const tuneCol = useAnimatedStyle(() => ({
    color: tw(has ? C.bg : C.green, 240, CSS_EASE),
  }));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 52,
        paddingLeft: 18,
        paddingRight: 6,
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 99,
      }}
    >
      <Glyph name="search" size={22} color={C.green} />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={
          isC ? 'Search collections' : 'Search recipes or ingredients'
        }
        placeholderTextColor={C.ink3}
        allowFontScaling={false}
        returnKeyType="search"
        autoCorrect={false}
        style={{
          flex: 1,
          minWidth: 0,
          padding: 0,
          fontFamily: F.sans400,
          fontSize: 15,
          color: C.ink,
        }}
      />
      <Press
        onPress={() => useNav.getState().set({ fs: true })}
        accessibilityLabel="Filter and sort"
        scale={0.9}
        easing={CSS_EASE}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        animatedStyle={tuneBg}
      >
        <Animated.Text allowFontScaling={false} style={[iconText(21), tuneCol]}>
          tune
        </Animated.Text>
        {has ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: 99,
              backgroundColor: C.terra,
              borderWidth: 2,
              borderColor: C.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(10, 700, C.bg, { lineHeight: 12 })}>
              {String(count)}
            </T>
          </View>
        ) : null}
      </Press>
    </View>
  );
}

function RecipesView({
  book,
  on,
  nSaved,
  collName,
  loading,
}: {
  book: BookItem[];
  on: boolean;
  nSaved: number;
  collName: string | null;
  loading: boolean;
}) {
  const filter = useCookbook((s) => s.filter);
  const gridOut = useCookbook((s) => s.gridOut);
  const view = useCookbook((s) => s.rf.view);
  const saved = useCookbook((s) => s.rf.saved);
  const open = useNav((s) => s.openRecipe);
  const toggleSave = useToggleSave();
  const grid = useAnimatedStyle(() => ({
    opacity: tw(gridOut ? 0 : 1, 160, CSS_EASE),
    transform: [{ translateY: tw(gridOut ? 8 : 0, 220, EASE) }],
  }));
  const onSave = useCallback(
    (r: TRecipe) => toggleSave(r.id, !r.saved),
    [toggleSave],
  );

  return (
    <>
      <Stagger i={3} on={on}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 14, marginBottom: 18, marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {collName ? <CollChip name={collName} /> : null}
          <SavedChip on={saved} n={nSaved} />
          <View
            style={{
              width: 1,
              height: 22,
              alignSelf: 'center',
              backgroundColor: C.line,
            }}
          />
          {FILTERS.map(([k, l]) => (
            <Pill
              key={k}
              label={l}
              on={filter === k}
              onPress={() => useCookbook.getState().setFilter(k)}
              paddingH={16}
              ms={260}
            />
          ))}
        </ScrollView>
      </Stagger>
      <Animated.View style={grid}>
        {loading ? (
          <Grid>
            {[0, 1, 2, 3].map((i) => (
              <PlaceholderCard key={i} i={i} />
            ))}
          </Grid>
        ) : view === 'grid' ? (
          <Grid>
            {book.map((b, i) => (
              <Stagger key={b.r.id} i={3 + Math.min(i, 6)} on={on}>
                <RecipeCard item={b} onOpen={open} onSave={onSave} />
              </Stagger>
            ))}
          </Grid>
        ) : (
          <View style={{ gap: 10 }}>
            {book.map((b, i) => (
              <Stagger key={b.r.id} i={3 + Math.min(i, 6)} on={on}>
                <RecipeRow item={b} onOpen={open} onSave={onSave} />
              </Stagger>
            ))}
          </View>
        )}
      </Animated.View>
      {!loading && book.length === 0 ? (
        <Empty
          title="Nothing matches yet"
          body="Loosen a filter, try another word, or import it with the + button."
          pad={[48, 20, 48]}
        />
      ) : null}
    </>
  );
}

function CollChip({ name }: { name: string }) {
  return (
    <Press
      onPress={() => useNav.getState().set({ cookbookColl: null })}
      style={{
        height: 38,
        paddingLeft: 14,
        paddingRight: 10,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: C.terra,
        backgroundColor: C.terraWash,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Glyph name="collections_bookmark" size={17} color={C.terraInk} />
      <T style={ctl(13, 700, C.terraInk)}>{name}</T>
      <Glyph name="close" size={17} color={C.terraInk} />
    </Press>
  );
}

function SavedChip({ on, n }: { on: boolean; n: number }) {
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.green : C.white, 260, CSS_EASE),
    borderColor: tw(on ? C.green : C.line, 260, CSS_EASE),
  }));
  const col = useAnimatedStyle(() => ({
    color: tw(on ? C.bg : C.ink, 260, CSS_EASE),
  }));
  return (
    <Press
      onPress={() =>
        useCookbook.getState().setRF((rf) => ({ saved: !rf.saved }))
      }
      accessibilityLabel="Show saved recipes"
      scale={0.95}
      easing={CSS_EASE}
      style={{
        height: 38,
        paddingLeft: 11,
        paddingRight: 14,
        borderRadius: 99,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
      animatedStyle={box}
    >
      <Glyph name="bookmark" size={18} fill color={on ? C.bg : C.terra} />
      <Animated.Text allowFontScaling={false} style={[ctl(13, 700), col]}>
        Saved
      </Animated.Text>
      <Animated.Text
        allowFontScaling={false}
        style={[
          sans(13, 700, C.ink, {
            opacity: 0.75,
            fontVariant: ['tabular-nums'],
          }),
          col,
        ]}
      >
        {String(n)}
      </Animated.Text>
    </Press>
  );
}

function useColW() {
  const { width } = useWindowDimensions();
  return (width - 40 - 12) / 2;
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 18,
        columnGap: 12,
      }}
    >
      {children}
    </View>
  );
}

type CardProps = {
  item: BookItem;
  onOpen: (id: string) => void;
  onSave: (r: TRecipe) => void;
};

const RecipeCard = memo(function RecipeCard({
  item: { r, meta },
  onOpen,
  onSave,
}: CardProps) {
  const w = useColW();
  return (
    <Press onPress={() => onOpen(r.id)} style={{ width: w }}>
      <Press onPress={() => onOpen(r.id)} scale={0.97} ms={240}>
        <Photo
          hue={r.hue}
          uri={r.uri}
          caption="photo"
          captionSize={10}
          radius={16}
          style={{ width: w, height: w }}
        />
        <BookmarkButton
          saved={r.saved}
          onPress={() => onSave(r)}
          size={34}
          iconSize={19}
          bg="rgba(248,250,245,.92)"
          pressScale={0.8}
          style={{ position: 'absolute', top: 8, right: 8 }}
        />
      </Press>
      <T style={serif(17, 600, C.ink, { lineHeight: 20.4, marginTop: 9 })}>
        {r.title}
      </T>
      <T style={sans(12, 400, C.ink2, { marginTop: 3 })}>{meta}</T>
    </Press>
  );
});

const RecipeRow = memo(function RecipeRow({
  item: { r, meta },
  onOpen,
  onSave,
}: CardProps) {
  return (
    <Press
      onPress={() => onOpen(r.id)}
      scale={0.98}
      easing={CSS_EASE}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 18,
        padding: 8,
      }}
    >
      <Photo
        hue={r.hue}
        uri={r.uri}
        radius={13}
        style={{ width: 72, height: 72 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={serif(17, 600, C.ink, { lineHeight: 20.4 })}>{r.title}</T>
        <T style={sans(12, 400, C.ink2, { marginTop: 3 })}>{meta}</T>
      </View>
      <BookmarkButton
        saved={r.saved}
        onPress={() => onSave(r)}
        size={44}
        iconSize={21}
        bg="transparent"
        pressScale={0.8}
      />
    </Press>
  );
});

function PlaceholderCard({ i }: { i: number }) {
  const w = useColW();
  return (
    <View style={{ width: w }}>
      <Photo
        hue={(i * 67 + 35) % 360}
        radius={16}
        style={{ width: w, height: w }}
      />
      <View style={{ height: 20.4, marginTop: 9 }} />
      <View style={{ height: 15, marginTop: 3 }} />
    </View>
  );
}

function Empty({
  title,
  body,
  pad,
}: {
  title: string;
  body: string;
  pad: [number, number, number];
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingTop: pad[0],
        paddingHorizontal: pad[1],
        paddingBottom: pad[2],
      }}
    >
      <T
        style={{
          fontFamily: F.serif400i,
          fontSize: 22,
          color: C.ink,
          textAlign: 'center',
        }}
      >
        {title}
      </T>
      <T style={sans(14, 400, C.ink2, { marginTop: 6, textAlign: 'center' })}>
        {body}
      </T>
    </View>
  );
}

function CollectionsView({
  colls,
  on,
  loading,
}: {
  colls: CollItem[];
  on: boolean;
  loading: boolean;
}) {
  const view = useCookbook((s) => s.cf.view);
  const newColl = () => useNav.getState().openNewCollection();
  const openColl = (id: string) => useCookbook.getState().openColl(id);
  return (
    <>
      <View style={{ height: 18 }} />
      {view === 'grid' ? (
        <Grid>
          {colls.map((c, i) => (
            <Stagger key={c.id} i={3 + Math.min(i, 6)} on={on}>
              <CollCard c={c} onOpen={openColl} />
            </Stagger>
          ))}
          <NewCollTile onPress={newColl} />
        </Grid>
      ) : (
        <View style={{ gap: 10 }}>
          {colls.map((c, i) => (
            <Stagger key={c.id} i={3 + Math.min(i, 6)} on={on}>
              <CollRow c={c} onOpen={openColl} />
            </Stagger>
          ))}
          <Press
            onPress={newColl}
            style={{
              height: 56,
              borderRadius: 18,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: C.lineStrong,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Glyph name="add" size={22} color={C.green} />
            <T style={sans(14, 700, C.green)}>New collection</T>
          </Press>
        </View>
      )}
      {!loading && colls.length === 0 ? (
        <Empty
          title="No collections match"
          body="Try another name or change what’s shown in filters."
          pad={[40, 20, 8]}
        />
      ) : null}
    </>
  );
}

function Mosaic({
  tiles,
  size,
  gap,
  radius,
}: {
  tiles: CollTile[];
  size: number;
  gap: number;
  radius: number;
}) {
  const t = (size - gap) / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: C.surface2,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
      }}
    >
      {tiles.map((x, j) =>
        x ? (
          <Photo
            key={j}
            hue={x.hue}
            uri={x.uri}
            style={{ width: t, height: t }}
          />
        ) : (
          <View
            key={j}
            style={{ width: t, height: t, backgroundColor: C.surface3 }}
          />
        ),
      )}
    </View>
  );
}

type CollProps = { c: CollItem; onOpen: (id: string) => void };

const CollCard = memo(function CollCard({ c, onOpen }: CollProps) {
  const w = useColW();
  return (
    <Press onPress={() => onOpen(c.id)} style={{ width: w }}>
      <Press onPress={() => onOpen(c.id)} scale={0.97} ms={240}>
        <Mosaic tiles={c.tiles} size={w} gap={3} radius={16} />
        {c.emo ? (
          <View
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: C.bg,
              boxShadow: '0 2px 8px rgba(36,39,36,.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontSize: 19, textAlign: 'center' }}>{c.emo}</T>
          </View>
        ) : null}
      </Press>
      <T style={serif(17, 600, C.ink, { lineHeight: 20.4, marginTop: 9 })}>
        {c.n}
      </T>
      <T style={sans(12, 400, C.ink2, { marginTop: 3 })}>{c.meta}</T>
    </Press>
  );
});

const CollRow = memo(function CollRow({ c, onOpen }: CollProps) {
  return (
    <Press
      onPress={() => onOpen(c.id)}
      scale={0.98}
      easing={CSS_EASE}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 18,
        paddingVertical: 8,
        paddingLeft: 8,
        paddingRight: 14,
      }}
    >
      <View>
        <Mosaic tiles={c.tiles} size={72} gap={2} radius={13} />
        {c.emo ? (
          <View
            style={{
              position: 'absolute',
              right: -6,
              bottom: -6,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: C.bg,
              borderWidth: 2,
              borderColor: C.white,
              boxShadow: '0 2px 6px rgba(36,39,36,.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontSize: 15, textAlign: 'center' }}>{c.emo}</T>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={serif(17, 600, C.ink, { lineHeight: 20.4 })}>{c.n}</T>
        <T style={sans(12, 400, C.ink2, { marginTop: 3 })}>{c.meta}</T>
      </View>
      <Glyph name="chevron_right" size={22} color={C.ink3} />
    </Press>
  );
});

function NewCollTile({ onPress }: { onPress: () => void }) {
  const w = useColW();
  return (
    <Press
      onPress={onPress}
      scale={0.97}
      easing={CSS_EASE}
      style={{
        width: w,
        height: w,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: C.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Glyph name="add" size={28} color={C.green} />
      <T style={sans(14, 700, C.green)}>New collection</T>
    </Press>
  );
}
