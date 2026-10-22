import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, useWindowDimensions, type TextInput } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useCreateCollection } from '@/features/collections/hooks';
import { LEVELS, useCookbook, useCookbookView } from '@/tortie/data/cookbook';
import { useFrame } from '@/tortie/frame';
import { toast, useNav } from '@/tortie/nav-store';
import { plz } from '@/tortie/lib/fmt';
import { C, CSS_EASE, F } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Grabber, Label, Switch } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { iconText } from '@/tortie/ui/icon-text';
import { Input, RevealBox } from '@/tortie/ui/input';
import { Press } from '@/tortie/ui/press';
import { Sheet, SheetScroll } from '@/tortie/ui/sheet';
import { ctl, em, sans, serif, T } from '@/tortie/ui/text';
import { useT } from '@/i18n';
import { lazyAt, tEnum, tNow } from '@/i18n/format';

const EMOS = [
  '',
  '🍝',
  '🥗',
  '🍲',
  '🥘',
  '🌮',
  '🍜',
  '🥐',
  '🍰',
  '🔥',
  '🌱',
  '⚡',
  '🎉',
  '❤️',
];

/** Sheet option pill: bg/colour/border 240ms, press .95. */
function SPill({
  label,
  on,
  onPress,
  icon,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  icon?: string;
}) {
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.green : C.white, 240, CSS_EASE),
    borderColor: tw(on ? C.green : C.line, 240, CSS_EASE),
  }));
  const txt = useAnimatedStyle(() => ({
    color: tw(on ? C.bg : C.ink, 240, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      scale={0.95}
      easing={CSS_EASE}
      accessibilityState={{ selected: on }}
      style={{
        height: 38,
        paddingHorizontal: 14,
        borderRadius: 99,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
      animatedStyle={box}
    >
      {icon ? (
        <Animated.Text allowFontScaling={false} style={[iconText(18), txt]}>
          {icon}
        </Animated.Text>
      ) : null}
      <Animated.Text allowFontScaling={false} style={[ctl(13, 600), txt]}>
        {label}
      </Animated.Text>
    </Press>
  );
}

function Pills({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {children}
    </View>
  );
}

function ShowCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 18,
        paddingVertical: 2,
        paddingHorizontal: 16,
      }}
    >
      {children}
    </View>
  );
}

function SwitchRow({
  title,
  sub,
  value,
  onChange,
}: {
  title: string;
  sub: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={sans(15, 600)}>{title}</T>
        <T style={sans(12, 400, C.ink2, { marginTop: 2 })}>{sub}</T>
      </View>
      <Switch value={value} onChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

const TIMES: ['any' | number, string][] = [
  lazyAt(['any', ''] as ['any' | number, string], 1, 'cookbook.any'),
  lazyAt([15, ''] as ['any' | number, string], 1, 'filter.time15'),
  lazyAt([30, ''] as ['any' | number, string], 1, 'filter.time30'),
  lazyAt([60, ''] as ['any' | number, string], 1, 'filter.time60'),
  lazyAt([180, ''] as ['any' | number, string], 1, 'filter.time180'),
];

export function CookbookFilterSheet() {
  const tr = useT();
  const f = useFrame();
  const open = useNav((s) => s.fs);
  const close = () => useNav.getState().set({ fs: false });
  const { rf, cf, setRF, setCF, resetRF, resetCF } = useCookbook();
  const v = useCookbookView();
  const isC = v.isC;
  const resetO = useAnimatedStyle(() => ({
    opacity: tw(v.aCnt ? 1 : 0.4, 200, CSS_EASE),
  }));
  const cta = isC
    ? tNow('cookbook.showCollections', {
        collections: plz(v.colls.length, 'collection'),
      })
    : tNow('cookbook.showRecipes', { recipes: plz(v.book.length, 'recipe') });

  return (
    <Sheet
      open={open}
      onClose={close}
      z={42}
      maxHeight={0.86}
      style={{ paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 }}
    >
      <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
        <Grabber />
        <T style={serif(26, 500, C.ink, { letterSpacing: em(26, -0.01) })}>
          {isC ? tr('cookbook.sortCollections') : tr('cookbook.filterSort')}
        </T>
      </View>
      <SheetScroll
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {isC ? (
          <>
            <Label>{tr('cookbook.sortBy')}</Label>
            <Pills>
              {(
                [
                  ['updated', tNow('cookbook.sortUpdated')],
                  ['az', tNow('cookbook.sortAz')],
                  ['size', tNow('cookbook.sortSize')],
                ] as const
              ).map(([k, l]) => (
                <SPill
                  key={k}
                  label={l}
                  on={cf.sort === k}
                  onPress={() => setCF({ sort: k })}
                />
              ))}
            </Pills>
            <Label>{tr('cookbook.owner')}</Label>
            <Pills>
              {(
                [
                  ['all', tNow('cookbook.ownerAll')],
                  ['mine', tNow('cookbook.ownerMine')],
                  ['shared', tNow('cookbook.ownerShared')],
                ] as const
              ).map(([k, l]) => (
                <SPill
                  key={k}
                  label={l}
                  on={cf.own === k}
                  onPress={() => setCF({ own: k })}
                />
              ))}
            </Pills>
            <Label>{tr('cookbook.show')}</Label>
            <ShowCard>
              <SwitchRow
                title={tr('cookbook.emptyCollections')}
                sub={tr('cookbook.keepCollectionsWithNo')}
                value={cf.empty}
                onChange={() => setCF({ empty: !cf.empty })}
              />
            </ShowCard>
            <Label>{tr('cookbook.layout')}</Label>
            <Pills>
              <SPill
                label={tr('cookbook.grid')}
                icon="grid_view"
                on={cf.view === 'grid'}
                onPress={() => setCF({ view: 'grid' })}
              />
              <SPill
                label={tr('cookbook.list')}
                icon="view_agenda"
                on={cf.view === 'list'}
                onPress={() => setCF({ view: 'list' })}
              />
            </Pills>
          </>
        ) : (
          <>
            <Label>{tr('cookbook.sortBy')}</Label>
            <Pills>
              {(
                [
                  ['recent', tNow('cookbook.sortRecent')],
                  ['az', tNow('cookbook.sortAz')],
                  ['quick', tNow('cookbook.sortQuick')],
                  ['cooked', tNow('cookbook.sortCooked')],
                ] as const
              ).map(([k, l]) => (
                <SPill
                  key={k}
                  label={l}
                  on={rf.sort === k}
                  onPress={() => setRF({ sort: k })}
                />
              ))}
            </Pills>
            <Label>{tr('common.totalTime')}</Label>
            <Pills>
              {TIMES.map(([k, l]) => (
                <SPill
                  key={String(k)}
                  label={k === 'any' ? l : '≤ ' + l}
                  on={rf.time === k}
                  onPress={() => setRF({ time: k })}
                />
              ))}
            </Pills>
            <Label>{tr('cookbook.difficulty')}</Label>
            <Pills>
              {LEVELS.map((k) => (
                <SPill
                  key={k}
                  label={tEnum('level', k)}
                  on={!!rf.lv[k]}
                  icon={rf.lv[k] ? 'check' : undefined}
                  onPress={() =>
                    setRF((cur) => ({ lv: { ...cur.lv, [k]: !cur.lv[k] } }))
                  }
                />
              ))}
            </Pills>
            <Label>{tr('cookbook.show')}</Label>
            <ShowCard>
              <SwitchRow
                title={tr('cookbook.cookFromMyPantry')}
                sub={tr('cookbook.atLeastAThird')}
                value={rf.pantry}
                onChange={() => setRF((cur) => ({ pantry: !cur.pantry }))}
              />
            </ShowCard>
            <Label>{tr('cookbook.layout')}</Label>
            <Pills>
              <SPill
                label={tr('cookbook.grid')}
                icon="grid_view"
                on={rf.view === 'grid'}
                onPress={() => setRF({ view: 'grid' })}
              />
              <SPill
                label={tr('cookbook.list')}
                icon="view_agenda"
                on={rf.view === 'list'}
                onPress={() => setRF({ view: 'list' })}
              />
            </Pills>
          </>
        )}
      </SheetScroll>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: f.sheetBottom,
          borderTopWidth: 1,
          borderTopColor: C.surface3,
        }}
      >
        <Press
          onPress={() => (isC ? resetCF() : resetRF())}
          style={{
            height: 54,
            paddingHorizontal: 22,
            borderWidth: 1.5,
            borderColor: C.line,
            borderRadius: 99,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          animatedStyle={resetO}
        >
          <T style={sans(15, 600)}>{tr('cookbook.reset')}</T>
        </Press>
        <Press
          onPress={close}
          scale={0.97}
          easing={CSS_EASE}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 99,
            backgroundColor: C.green,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(15, 700, C.bg)}>{cta}</T>
        </Press>
      </View>
    </Sheet>
  );
}

export function NewCollectionSheet() {
  const tr = useT();
  const f = useFrame();
  const { width } = useWindowDimensions();
  const open = useNav((s) => s.nc);
  const recipeIds = useNav((s) => s.ncRecipeIds);
  const [name, setName] = useState('');
  const [emo, setEmo] = useState('');
  const ref = useRef<TextInput>(null);
  const create = useCreateCollection();
  const has = name.trim().length > 0;

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName('');
      setEmo('');
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ref.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [open]);

  const close = () => {
    ref.current?.blur();
    useNav.getState().set({ nc: false });
  };
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    ref.current?.blur();
    useNav.getState().set({ nc: false });
    useCookbook.getState().setCF({ empty: true });
    create.mutate(
      {
        name: emo ? emo + ' ' + n : n,
        ...(recipeIds.length ? { recipeIds } : {}),
      },
      { onError: () => toast(tr('cookbook.couldntCreateThatCollection')) },
    );
    toast(tNow('cookbook.created', { name: (emo ? emo + ' ' : '') + n }));
  };

  const inputBd = useAnimatedStyle(() => ({
    borderColor: tw(has ? C.green : C.line, 200, CSS_EASE),
  }));
  const btnO = useAnimatedStyle(() => ({
    opacity: tw(has ? 1 : 0.4, 200, CSS_EASE),
  }));
  const cell = (width - 40 - 6 * 6) / 7;

  return (
    <Sheet
      open={open}
      onClose={close}
      avoidKeyboard
      style={{ paddingBottom: Math.max(36, f.sheetBottom) }}
    >
      <Grabber />
      <T style={serif(26, 500, C.ink, { letterSpacing: em(26, -0.01) })}>
        {tr('common.newCollection')}
      </T>
      <RevealBox
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 18,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(26, 400, C.ink3, { textAlign: 'center' })}>
            {emo || '?'}
          </T>
        </View>
        <Animated.View
          style={[
            {
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              height: 56,
              paddingHorizontal: 18,
              backgroundColor: C.surface2,
              borderWidth: 1,
              borderRadius: 99,
            },
            inputBd,
          ]}
        >
          <Input
            ref={ref}
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            maxLength={40}
            placeholder={tr('cookbook.nameItEG')}
            placeholderTextColor={C.ink3}
            allowFontScaling={false}
            returnKeyType="done"
            style={{
              flex: 1,
              minWidth: 0,
              padding: 0,
              fontFamily: F.sans400,
              fontSize: 15,
              color: C.ink,
            }}
          />
        </Animated.View>
      </RevealBox>
      <T
        style={sans(12, 700, C.ink2, {
          letterSpacing: em(12, 0.08),
          textTransform: 'uppercase',
          marginTop: 20,
        })}
      >
        {tNow('common.emoji')}{' '}
        <T
          style={sans(12, 600, C.ink3, {
            letterSpacing: 0,
            textTransform: 'none',
          })}
        >
          {tr('cookbook.optional')}
        </T>
      </T>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 10,
        }}
      >
        {EMOS.map((g) => (
          <EmojiCell
            key={g || 'none'}
            g={g}
            on={emo === g}
            size={cell}
            onPress={() => setEmo(g)}
          />
        ))}
      </View>
      <Press
        onPress={submit}
        scale={0.97}
        easing={CSS_EASE}
        style={{
          height: 54,
          marginTop: 22,
          borderRadius: 99,
          backgroundColor: C.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        animatedStyle={btnO}
      >
        <T style={sans(15, 700, C.bg)}>{tr('cookbook.createCollection')}</T>
      </Press>
    </Sheet>
  );
}

function EmojiCell({
  g,
  on,
  size,
  onPress,
}: {
  g: string;
  on: boolean;
  size: number;
  onPress: () => void;
}) {
  const tr = useT();
  const a = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.greenSoft : C.white, 200, CSS_EASE),
    borderColor: tw(on ? C.green : C.line, 200, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      scale={0.88}
      easing={CSS_EASE}
      accessibilityLabel={g || tr('cookbook.noEmoji')}
      accessibilityState={{ selected: on }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      animatedStyle={a}
    >
      {g ? (
        <T style={{ fontSize: 20, textAlign: 'center' }}>{g}</T>
      ) : (
        <Glyph name="block" size={20} color={C.ink3} />
      )}
    </Press>
  );
}
