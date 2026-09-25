import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useCreateCollection } from '@/features/collections/hooks';
import { LEVELS, useCookbook, useCookbookView } from '@/tortie/data/cookbook';
import { useFrame } from '@/tortie/frame';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, F } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Grabber, Label, Switch } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { iconText } from '@/tortie/ui/icon-text';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { ctl, em, sans, serif, T } from '@/tortie/ui/text';

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
  ['any', 'Any'],
  [15, '15 min'],
  [30, '30 min'],
  [60, '1 hour'],
  [180, '3 hours'],
];

export function CookbookFilterSheet() {
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
    ? 'Show ' +
      v.colls.length +
      ' collection' +
      (v.colls.length === 1 ? '' : 's')
    : 'Show ' + v.book.length + ' recipe' + (v.book.length === 1 ? '' : 's');

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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <T style={serif(26, 500, C.ink, { letterSpacing: em(26, -0.01) })}>
            {isC ? 'Sort collections' : 'Filter & sort'}
          </T>
          <Press
            onPress={close}
            accessibilityLabel="Close"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: C.surface3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="close" size={20} color={C.ink} />
          </Press>
        </View>
      </View>
      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {isC ? (
          <>
            <Label>Sort by</Label>
            <Pills>
              {(
                [
                  ['updated', 'Recently updated'],
                  ['az', 'A–Z'],
                  ['size', 'Most recipes'],
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
            <Label>Owner</Label>
            <Pills>
              {(
                [
                  ['all', 'All'],
                  ['mine', 'Mine'],
                  ['shared', 'Shared with me'],
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
            <Label>Show</Label>
            <ShowCard>
              <SwitchRow
                title="Empty collections"
                sub="Keep collections with no recipes yet"
                value={cf.empty}
                onChange={() => setCF({ empty: !cf.empty })}
              />
            </ShowCard>
            <Label>Layout</Label>
            <Pills>
              <SPill
                label="Grid"
                icon="grid_view"
                on={cf.view === 'grid'}
                onPress={() => setCF({ view: 'grid' })}
              />
              <SPill
                label="List"
                icon="view_agenda"
                on={cf.view === 'list'}
                onPress={() => setCF({ view: 'list' })}
              />
            </Pills>
          </>
        ) : (
          <>
            <Label>Sort by</Label>
            <Pills>
              {(
                [
                  ['recent', 'Recently added'],
                  ['az', 'A–Z'],
                  ['quick', 'Quickest'],
                  ['cooked', 'Most cooked'],
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
            <Label>Total time</Label>
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
            <Label>Difficulty</Label>
            <Pills>
              {LEVELS.map((k) => (
                <SPill
                  key={k}
                  label={k}
                  on={!!rf.lv[k]}
                  icon={rf.lv[k] ? 'check' : undefined}
                  onPress={() =>
                    setRF((cur) => ({ lv: { ...cur.lv, [k]: !cur.lv[k] } }))
                  }
                />
              ))}
            </Pills>
            <Label>Show</Label>
            <ShowCard>
              <SwitchRow
                title="Saved only"
                sub="Recipes you’ve bookmarked"
                value={rf.saved}
                onChange={() => setRF((cur) => ({ saved: !cur.saved }))}
              />
              <View style={{ height: 1, backgroundColor: C.surface3 }} />
              <SwitchRow
                title="Cook from my pantry"
                sub="At least a third of the ingredients are at home"
                value={rf.pantry}
                onChange={() => setRF((cur) => ({ pantry: !cur.pantry }))}
              />
            </ShowCard>
            <Label>Layout</Label>
            <Pills>
              <SPill
                label="Grid"
                icon="grid_view"
                on={rf.view === 'grid'}
                onPress={() => setRF({ view: 'grid' })}
              />
              <SPill
                label="List"
                icon="view_agenda"
                on={rf.view === 'list'}
                onPress={() => setRF({ view: 'list' })}
              />
            </Pills>
          </>
        )}
      </ScrollView>
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
          <T style={sans(15, 600)}>Reset</T>
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

/** iOS keyboard height (Android pans the window: `softwareKeyboardLayoutMode: pan`). */
function useKeyboardLift() {
  const [kb, setKb] = useState({ h: 0, ms: 250 });
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const a = Keyboard.addListener('keyboardWillShow', (e) =>
      setKb({ h: e.endCoordinates.height, ms: e.duration || 250 }),
    );
    const b = Keyboard.addListener('keyboardWillHide', (e) =>
      setKb({ h: 0, ms: e.duration || 250 }),
    );
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  const a = useAnimatedStyle(() => ({ bottom: tw(kb.h, kb.ms, EASE) }));
  // Sheet renders `style` on its Animated.View, so an animated style is safe despite the ViewStyle type.
  return a as unknown as ViewStyle;
}

export function NewCollectionSheet() {
  const f = useFrame();
  const { width } = useWindowDimensions();
  const open = useNav((s) => s.nc);
  const forRecipe = useNav((s) => s.ncForRecipe);
  const [name, setName] = useState('');
  const [emo, setEmo] = useState('');
  const ref = useRef<TextInput>(null);
  const create = useCreateCollection();
  const lift = useKeyboardLift();
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
        ...(forRecipe ? { recipeIds: [forRecipe] } : {}),
      },
      { onError: () => toast('Couldn’t create that collection. Try again.') },
    );
    toast('Created ' + (emo ? emo + ' ' : '') + n);
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
      style={[{ paddingBottom: Math.max(36, f.sheetBottom) }, lift]}
    >
      <Grabber />
      <T style={serif(26, 500, C.ink, { letterSpacing: em(26, -0.01) })}>
        New collection
      </T>
      <View
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
          <TextInput
            ref={ref}
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            maxLength={40}
            placeholder="Name it — e.g. Soup season"
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
      </View>
      <T
        style={sans(12, 700, C.ink2, {
          letterSpacing: em(12, 0.08),
          textTransform: 'uppercase',
          marginTop: 20,
        })}
      >
        Emoji{' '}
        <T
          style={sans(12, 600, C.ink3, {
            letterSpacing: 0,
            textTransform: 'none',
          })}
        >
          · optional
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
        <T style={sans(15, 700, C.bg)}>Create collection</T>
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
  const a = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.greenSoft : C.white, 200, CSS_EASE),
    borderColor: tw(on ? C.green : C.line, 200, CSS_EASE),
  }));
  return (
    <Press
      onPress={onPress}
      scale={0.88}
      easing={CSS_EASE}
      accessibilityLabel={g || 'No emoji'}
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
