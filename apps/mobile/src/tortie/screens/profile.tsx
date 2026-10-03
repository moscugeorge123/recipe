import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useCollections } from '@/features/collections/hooks';
import { useCookSessions } from '@/features/cook-sessions/hooks';
import { useTortieAuth, type TortieUser } from '@/tortie/auth-store';
import { useTRecipes } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { motionMultiplier } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { useTortiePrefs, type DietKey } from '@/tortie/prefs-store';
import { C, CSS_EASE, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { GuestArt } from '@/tortie/ui/art';
import { BrandLogo } from '@/tortie/ui/brand';
import { Pill, Switch } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { Stagger } from '@/tortie/ui/stagger';
import { em, kicker, sans, serif, T } from '@/tortie/ui/text';

const PROV_NAME = { google: 'Google', facebook: 'Facebook' } as const;

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/** Display name; OAuth sign-ins have no name until the API supports accounts. */
export function nameOf(u: TortieUser | null): string {
  if (!u) return '';
  if (u.name) return u.name;
  return u.prov === 'email' ? u.email : `${PROV_NAME[u.prov]} account`;
}

export function ProfileScreen() {
  const f = useFrame();
  const prof = useNav((s) => s.prof);
  const mounted = useNav((s) => s.mounted);
  const pfOut = useNav((s) => s.pfOut);
  const profNonce = useNav((s) => s.profNonce);
  const closeProfile = useNav((s) => s.closeProfile);
  const authed = useTortieAuth((s) => s.authed);
  const user = useTortieAuth((s) => s.user);
  const scrollRef = useRef<ScrollView>(null);
  // Scroll state is scoped to one opening so it resets without an effect.
  const [scrState, setScrState] = useState({ n: profNonce, v: false });
  const scr = scrState.n === profNonce && scrState.v;
  const setScr = (v: boolean) => setScrState({ n: profNonce, v });

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [profNonce]);

  const on = prof && mounted && !pfOut;
  const pAv = scr && authed;
  const name = nameOf(user);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = e.nativeEvent.contentOffset.y > 96;
    if (v !== scr) setScr(v);
  };

  const hdrBg = useAnimatedStyle(() => ({
    opacity: tw(scr ? 1 : 0, 240, CSS_EASE),
  }));
  const ttl = useAnimatedStyle(() => ({
    opacity: tw(pAv ? 0 : 1, 220, CSS_EASE),
    transform: [{ translateY: tw(pAv ? -8 : 0, 320) }],
  }));
  const nm = useAnimatedStyle(() => ({
    opacity: tw(pAv ? 1 : 0, 220, CSS_EASE),
    transform: [{ translateY: tw(pAv ? 0 : 8, 320) }],
  }));
  const mini = useAnimatedStyle(() => ({
    opacity: tw(pAv ? 1 : 0, 240, CSS_EASE),
    transform: [
      { translateX: tw(pAv ? 0 : -60, 420, SPRING) },
      { translateY: tw(pAv ? 0 : 50, 420, SPRING) },
      { scale: tw(pAv ? 1 : 0.5, 420, SPRING) },
    ],
  }));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={{
          paddingTop: f.pushTop + 44 + 8,
          paddingBottom: 44 + f.bottom,
        }}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {authed ? (
            <SignedIn on={on} heroHidden={pAv} user={user} name={name} />
          ) : (
            <Guest on={on} />
          )}
        </View>
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
          paddingTop: f.pushTop,
          paddingHorizontal: 20,
          paddingBottom: 8,
        }}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              {
                flex: 1,
                boxShadow: SH.header,
                overflow: 'hidden',
              },
              hdrBg,
            ]}
          >
            <BlurView
              intensity={40}
              tint="light"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(248,250,245)',
              }}
            />
          </Animated.View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            height: 44,
            zIndex: 1,
          }}
        >
          <Press
            onPress={closeProfile}
            scale={0.9}
            accessibilityLabel="Back"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              borderWidth: 1,
              borderColor: C.line,
              backgroundColor: C.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="arrow_back" size={22} color={C.ink} />
          </Press>
          <View style={{ flex: 1, minWidth: 0, height: 22 }}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  alignItems: 'center',
                },
                ttl,
              ]}
            >
              <T style={[sans(15, 700), { lineHeight: 22 }]}>
                {authed ? 'Profile' : 'Account'}
              </T>
            </Animated.View>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  alignItems: 'center',
                },
                nm,
              ]}
            >
              <T numberOfLines={1} style={[sans(15, 700), { lineHeight: 22 }]}>
                {name}
              </T>
            </Animated.View>
          </View>
          <View
            pointerEvents={pAv ? 'auto' : 'none'}
            style={{
              width: 42,
              height: 42,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Press
              onPress={() => toast('Choose a new profile photo')}
              scale={0.88}
              accessibilityLabel="Change photo"
              style={{
                width: 42,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    width: 42,
                    height: 42,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  mini,
                ]}
              >
                {authed ? (
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: C.green,
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 2px #f8faf5, 0 0 0 3.5px #c7ecce',
                    }}
                  >
                    <T style={sans(14, 700, C.bg)}>{initialsOf(name)}</T>
                  </View>
                ) : null}
              </Animated.View>
            </Press>
          </View>
        </View>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <T
      style={[
        kicker(C.green),
        { marginTop: 26, marginBottom: 8, marginHorizontal: 4 },
      ]}
    >
      {children}
    </T>
  );
}

const CARD = {
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.line,
  borderRadius: 18,
  paddingVertical: 2,
  paddingHorizontal: 16,
} as const;
const DIVIDER = { height: 1, backgroundColor: C.surface3 } as const;

function RowText({ l, sub }: { l: string; sub?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <T style={sans(15, 600)}>{l}</T>
      {sub ? (
        <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>{sub}</T>
      ) : null}
    </View>
  );
}

function SignedIn({
  on,
  heroHidden,
  user,
  name,
}: {
  on: boolean;
  heroHidden: boolean;
  user: TortieUser | null;
  name: string;
}) {
  const prefs = useTortiePrefs();
  const linked = useTortieAuth((s) => s.linked);
  const link = useTortieAuth((s) => s.link);
  const recipes = useTRecipes();
  const colls = useCollections();
  const cooked = useCookSessions({ status: 'COMPLETED', pageSize: 1 });

  const hero = useAnimatedStyle(() => ({
    opacity: tw(heroHidden ? 0 : 1, 260, CSS_EASE),
    transform: [
      { translateX: tw(heroHidden ? 90 : 0, 420) },
      { translateY: tw(heroHidden ? -60 : 0, 420) },
      { scale: tw(heroHidden ? 0.4 : 1, 420) },
    ],
  }));

  const signOut = () => {
    useNav.getState().set({ pfOut: true });
    setTimeout(
      () => {
        useTortieAuth.getState().signOut();
        useNav.getState().set({ pfOut: false });
      },
      Math.round(280 * motionMultiplier()),
    );
    toast('Signed out');
  };

  const prov = user?.prov ?? 'email';
  const stats: [string, string][] = [
    [String(cooked.data?.meta.total ?? 0), 'meals cooked'],
    [String(recipes.total), 'recipes'],
    [String(colls.data?.items.length ?? 0), 'collections'],
  ];
  const DIETS: [DietKey, string][] = [
    ['veg', 'Vegetarian'],
    ['pesc', 'Pescatarian'],
    ['gf', 'Gluten-free'],
    ['df', 'Dairy-free'],
    ['nut', 'No nuts'],
  ];
  const cookRows: [string, string, string, boolean, () => void][] = [
    [
      'mic',
      'Voice commands',
      'Say “next” to move between steps',
      prefs.voice,
      () => prefs.set({ voice: !prefs.voice }),
    ],
    [
      'notifications_active',
      'Timer alerts',
      'Rings an alarm, even if the app is closed',
      prefs.timerAlerts,
      () => prefs.set({ timerAlerts: !prefs.timerAlerts }),
    ],
    [
      'light_mode',
      'Keep screen awake',
      'While a recipe is open in cook mode',
      prefs.keepAwake,
      () => prefs.set({ keepAwake: !prefs.keepAwake }),
    ],
  ];

  return (
    <>
      <Stagger i={0} on={on} style={{ alignItems: 'center', paddingTop: 14 }}>
        <Animated.View style={hero}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: C.green,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 4px #f8faf5, 0 0 0 6px #c7ecce',
            }}
          >
            <T style={serif(38, 500, C.bg)}>{initialsOf(name)}</T>
          </View>
          <Press
            onPress={() => toast('Choose a new profile photo')}
            scale={0.88}
            accessibilityLabel="Change photo"
            style={{
              position: 'absolute',
              right: -4,
              bottom: -2,
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 3,
              borderColor: C.bg,
              backgroundColor: C.terra,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="photo_camera" size={17} color={C.bg} />
          </Press>
        </Animated.View>
        <T
          style={[
            serif(30, 500),
            {
              letterSpacing: em(30, -0.015),
              lineHeight: 33,
              marginTop: 16,
              textAlign: 'center',
            },
          ]}
        >
          {name}
        </T>
        {user?.email ? (
          <T style={[sans(14, 400, C.ink2), { marginTop: 4 }]}>{user.email}</T>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            height: 30,
            paddingLeft: 10,
            paddingRight: 12,
            borderRadius: 99,
            backgroundColor: C.greenWash3,
          }}
        >
          {prov === 'email' ? (
            <Glyph name="mail" size={16} color={C.green} />
          ) : (
            <BrandLogo brand={prov} size={14} />
          )}
          <T style={sans(12, 700, C.green)}>
            {prov === 'email'
              ? 'Signed in with email'
              : `Signed in with ${PROV_NAME[prov]}`}
          </T>
        </View>
      </Stagger>

      <Stagger
        i={1}
        on={on}
        style={{
          flexDirection: 'row',
          marginTop: 24,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 18,
          paddingVertical: 14,
        }}
      >
        {stats.map(([v, l], i) => (
          <View
            key={l}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 2,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: C.surface3,
            }}
          >
            <T style={[serif(26, 600), { lineHeight: 28.6 }]}>{v}</T>
            <T style={sans(12, 400, C.ink2)}>{l}</T>
          </View>
        ))}
      </Stagger>

      <Stagger i={2} on={on}>
        <SectionLabel>Kitchen</SectionLabel>
        <View style={CARD}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 12,
            }}
          >
            <Glyph name="group" size={22} color={C.green} />
            <RowText l="Default servings" sub="Recipes open scaled to this" />
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <StepBtn
                icon="remove"
                label="Fewer"
                onPress={() =>
                  prefs.set({
                    defaultServings: Math.max(1, prefs.defaultServings - 1),
                  })
                }
              />
              <T
                style={[
                  sans(16, 700),
                  {
                    minWidth: 14,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {prefs.defaultServings}
              </T>
              <StepBtn
                icon="add"
                label="More"
                onPress={() =>
                  prefs.set({
                    defaultServings: Math.min(12, prefs.defaultServings + 1),
                  })
                }
              />
            </View>
          </View>
          <View style={DIVIDER} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 12,
            }}
          >
            <Glyph name="straighten" size={22} color={C.green} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={sans(15, 600)}>Units</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pill
                label="Metric"
                on={prefs.units === 'metric'}
                onPress={() => prefs.set({ units: 'metric' })}
                height={32}
                paddingH={12}
                size={12}
                weight={700}
              />
              <Pill
                label="Imperial"
                on={prefs.units === 'imperial'}
                onPress={() => prefs.set({ units: 'imperial' })}
                height={32}
                paddingH={12}
                size={12}
                weight={700}
              />
            </View>
          </View>
          <View style={DIVIDER} />
          <View style={{ paddingTop: 12, paddingBottom: 14 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <Glyph name="eco" size={22} color={C.green} />
              <RowText
                l="Dietary preferences"
                sub="Tortie flags recipes that don’t fit"
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}
            >
              {DIETS.map(([k, l]) => {
                const v = !!prefs.diet[k];
                return (
                  <Pill
                    key={k}
                    label={l}
                    on={v}
                    icon={v ? 'check' : undefined}
                    iconSize={16}
                    onPress={() =>
                      prefs.set({ diet: { ...prefs.diet, [k]: !v } })
                    }
                    height={34}
                    paddingH={12}
                    style={{ gap: 4 }}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </Stagger>

      <Stagger i={3} on={on}>
        <SectionLabel>Cook mode</SectionLabel>
        <View style={CARD}>
          {cookRows.map(([icon, l, sub, v, fn], i) => (
            <View
              key={l}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 12,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: C.surface3,
              }}
            >
              <Glyph name={icon} size={22} color={C.green} />
              <RowText l={l} sub={sub} />
              <Switch value={v} onChange={fn} accessibilityLabel={l} />
            </View>
          ))}
        </View>
      </Stagger>

      <Stagger i={4} on={on}>
        <SectionLabel>Connected accounts</SectionLabel>
        <View style={CARD}>
          {(['google', 'facebook'] as const).map((k, i) => {
            const isOn = linked[k];
            const n = PROV_NAME[k];
            return (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: C.surface3,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: C.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BrandLogo brand={k} size={18} />
                </View>
                <RowText
                  l={n}
                  sub={
                    prov === k
                      ? 'Used to sign in'
                      : isOn
                        ? 'Connected'
                        : `Sign in with ${n} too`
                  }
                />
                {isOn ? (
                  <Glyph name="check_circle" size={24} color={C.green} fill />
                ) : (
                  <Press
                    onPress={() => {
                      link(k);
                      toast(`${n} connected`);
                    }}
                    scale={0.94}
                    pressedBg={C.greenWash3}
                    bg="transparent"
                    style={{
                      height: 34,
                      paddingHorizontal: 14,
                      borderRadius: 99,
                      borderWidth: 1,
                      borderColor: C.green,
                      justifyContent: 'center',
                    }}
                  >
                    <T style={sans(13, 700, C.green)}>Connect</T>
                  </Press>
                )}
              </View>
            );
          })}
        </View>
      </Stagger>

      <Stagger i={5} on={on}>
        <Press
          onPress={signOut}
          scale={0.97}
          style={{
            height: 54,
            marginTop: 28,
            borderRadius: 99,
            borderWidth: 1.5,
            borderColor: C.terraSoft,
            backgroundColor: C.terraWash,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Glyph name="logout" size={20} color={C.terraInk} />
          <T style={sans(15, 700, C.terraInk)}>Sign out</T>
        </Press>
      </Stagger>
    </>
  );
}

function StepBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.88}
      accessibilityLabel={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: C.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={18} color={C.ink} />
    </Press>
  );
}

function Guest({ on }: { on: boolean }) {
  const openAuth = useNav((s) => s.openAuth);
  const recipes = useTRecipes();
  const colls = useCollections();
  const perks: [string, string, string][] = [
    [
      'cloud_sync',
      'Every device, in sync',
      'Recipes, plans and pantry follow you from phone to tablet.',
    ],
    [
      'group',
      'Cook together',
      'Share collections and the grocery list with your household.',
    ],
    [
      'history',
      'Remember every meal',
      'Keep a cooking history and see what you make most.',
    ],
  ];
  const outline = {
    height: 54,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  } as const;
  return (
    <>
      <Stagger
        i={0}
        on={on}
        style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 4 }}
      >
        <GuestArt />
      </Stagger>
      <Stagger i={1} on={on} style={{ alignItems: 'center' }}>
        <T
          style={[
            serif(30, 500),
            {
              letterSpacing: em(30, -0.015),
              lineHeight: 33.6,
              marginTop: 14,
              textAlign: 'center',
            },
          ]}
        >
          Keep your kitchen with you
        </T>
        <T
          style={[
            sans(14, 400, C.ink2),
            {
              lineHeight: 21,
              marginTop: 8,
              maxWidth: 300,
              textAlign: 'center',
            },
          ]}
        >
          Sign in to back up your recipes, plans and pantry — and pick up on any
          device.
        </T>
      </Stagger>
      <Stagger
        i={2}
        on={on}
        style={{
          gap: 14,
          marginTop: 24,
          padding: 16,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 18,
        }}
      >
        {perks.map(([icon, t, d]) => (
          <View
            key={t}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: C.greenWash3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name={icon} size={21} color={C.green} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={sans(15, 600)}>{t}</T>
              <T
                style={[
                  sans(12, 400, C.ink2),
                  { lineHeight: 16.8, marginTop: 2 },
                ]}
              >
                {d}
              </T>
            </View>
          </View>
        ))}
      </Stagger>
      <Stagger i={3} on={on} style={{ gap: 10, marginTop: 24 }}>
        <Press
          onPress={() => openAuth('signup', 'google')}
          scale={0.97}
          bg={C.white}
          pressedBg={C.surface2}
          style={outline}
        >
          <BrandLogo brand="google" size={20} />
          <T style={sans(15, 700)}>Continue with Google</T>
        </Press>
        <Press
          onPress={() => openAuth('signup', 'facebook')}
          scale={0.97}
          bg={C.white}
          pressedBg={C.surface2}
          style={outline}
        >
          <BrandLogo brand="facebook" size={20} />
          <T style={sans(15, 700)}>Continue with Facebook</T>
        </Press>
        <Press
          onPress={() => openAuth('signup')}
          scale={0.97}
          style={{
            height: 54,
            borderRadius: 99,
            backgroundColor: C.green,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Glyph name="mail" size={20} color={C.bg} />
          <T style={sans(15, 700, C.bg)}>Sign up with email</T>
        </Press>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
          }}
        >
          <T style={sans(14, 400, C.ink2)}>Already have an account?</T>
          <Press onPress={() => openAuth('login')} style={{ padding: 4 }}>
            <T style={sans(14, 700, C.green)}>Log in</T>
          </Press>
        </View>
      </Stagger>
      <Stagger
        i={4}
        on={on}
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
          marginTop: 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 16,
          backgroundColor: C.surface2,
        }}
      >
        <Glyph name="smartphone" size={18} color={C.green} />
        <T style={[sans(12, 400, C.ink2), { lineHeight: 17.4, flex: 1 }]}>
          {`Your ${recipes.total} recipes and ${colls.data?.items.length ?? 0} collections live on this phone for now. Sign in and they move into your account.`}
        </T>
      </Stagger>
    </>
  );
}
