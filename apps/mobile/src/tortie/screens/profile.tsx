import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { isFacebookEnabled } from '@/constants/env';
import { useT } from '@/i18n';
import {
  APP_LANGUAGES,
  RECIPE_LANGUAGES,
  type AppLanguagePref,
  type RecipeLanguagePref,
} from '@/i18n/languages';
import { AuthError, authService } from '@/features/auth/auth-service';
import { removeAvatar, uploadAvatar } from '@/features/auth/avatar-service';
import { pickAvatar } from '@/features/auth/pick-avatar';
import { useCollections } from '@/features/collections/hooks';
import { useCookSessions } from '@/features/cook-sessions/hooks';
import { useTortieAuth, type TortieUser } from '@/tortie/auth-store';
import { useTRecipes } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { initialsOf, nameOf, PROV_NAME } from '@/tortie/lib/user-display';
import { toast, useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import { clampSnooze } from '@/tortie/timer-clock';
import { C, CSS_EASE, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { BrandLogo } from '@/tortie/ui/brand';
import { Avatar } from '@/tortie/ui/avatar';
import { Grabber, Pill, Switch } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { Select, type SelectOption } from '@/tortie/ui/select';
import { Sheet } from '@/tortie/ui/sheet';
import { Stagger } from '@/tortie/ui/stagger';
import { em, kicker, sans, serif, T } from '@/tortie/ui/text';

/** User-facing text for a failed auth call; `null` when the user backed out. */
function authMessage(e: unknown, fallback: string): string | null {
  if (e instanceof AuthError) {
    if (e.failure.kind === 'cancelled') return null;
    if (e.failure.kind === 'error') return e.failure.message;
  }
  return fallback;
}

export { initialsOf, nameOf };

export function ProfileScreen() {
  const f = useFrame();
  const prof = useNav((s) => s.prof);
  const mounted = useNav((s) => s.mounted);
  const pfOut = useNav((s) => s.pfOut);
  const profNonce = useNav((s) => s.profNonce);
  const closeProfile = useNav((s) => s.closeProfile);
  const user = useTortieAuth((s) => s.user);
  const signingOut = useTortieAuth((s) => s.signingOut);
  // Scoped to one opening: Profile stays mounted, so a sheet left open by Back would reappear.
  const [photoState, setPhotoState] = useState({ n: profNonce, v: false });
  const photoOpen = photoState.n === profNonce && photoState.v && prof;
  const setPhotoOpen = (v: boolean) => setPhotoState({ n: profNonce, v });
  const scrollRef = useRef<ScrollView>(null);
  // Scroll state is scoped to one opening so it resets without an effect.
  const [scrState, setScrState] = useState({ n: profNonce, v: false });
  const scr = scrState.n === profNonce && scrState.v;
  const setScr = (v: boolean) => setScrState({ n: profNonce, v });

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [profNonce]);

  const on = prof && mounted && !pfOut;
  const pAv = scr;
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
          <SignedIn
            on={on}
            heroHidden={pAv}
            user={user}
            name={name}
            onChangePhoto={() => setPhotoOpen(true)}
          />
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
              <T style={[sans(15, 700), { lineHeight: 22 }]}>Profile</T>
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
              onPress={() => setPhotoOpen(true)}
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
                <Avatar
                  size={38}
                  style={{
                    boxShadow: '0 0 0 2px #f8faf5, 0 0 0 3.5px #c7ecce',
                  }}
                />
              </Animated.View>
            </Press>
          </View>
        </View>
      </View>
      <PhotoSheet open={photoOpen} onClose={() => setPhotoOpen(false)} />
      {signingOut ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 70,
              backgroundColor: C.bg,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <T style={sans(15, 600, C.ink2)}>Signing out…</T>
        </View>
      ) : null}
    </View>
  );
}

/** Take, choose or remove the profile picture. */
function PhotoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const f = useFrame();
  const hasPhoto = useTortieAuth((s) => !!s.user?.photoURL);
  const rows: [string, string, 'camera' | 'library' | 'remove'][] = [
    ['photo_camera', 'Take photo', 'camera'],
    ['photo_library', 'Choose from library', 'library'],
    ...(hasPhoto
      ? ([['delete', 'Remove photo', 'remove']] as [string, string, 'remove'][])
      : []),
  ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      z={60}
      style={{ paddingBottom: Math.max(28, f.sheetBottom) }}
    >
      <Grabber />
      <T style={[serif(24, 500), { marginBottom: 8 }]}>Profile photo</T>
      {rows.map(([icon, label, action]) => (
        <Press
          key={action}
          onPress={() => {
            onClose();
            void changePhoto(action);
          }}
          scale={0.98}
          bg="transparent"
          pressedBg={C.surface2}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            height: 54,
            borderRadius: 14,
          }}
        >
          <Glyph
            name={icon}
            size={22}
            color={action === 'remove' ? C.terraInk : C.green}
          />
          <T style={sans(15, 600, action === 'remove' ? C.terraInk : C.ink)}>
            {label}
          </T>
        </Press>
      ))}
    </Sheet>
  );
}

/** Runs one photo action. A failed upload keeps the old picture and offers Retry. */
async function changePhoto(action: 'camera' | 'library' | 'remove') {
  try {
    if (action === 'remove') {
      await removeAvatar();
      toast('Photo removed');
      return;
    }
    const picked = await pickAvatar(action);
    if (picked.status === 'cancelled') return;
    if (picked.status === 'denied') {
      Alert.alert(
        'Camera access is off',
        'Allow Tortie to use the camera in Settings to take a profile photo.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    await uploadAvatar(picked.uri);
    toast('Profile photo updated');
  } catch (e) {
    const tooLarge = e instanceof Error && e.message === 'too-large';
    Alert.alert(
      'Couldn’t update your photo',
      tooLarge
        ? 'That photo is too large. Pick a smaller one.'
        : 'Check your connection and try again. Your current photo is unchanged.',
      tooLarge
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => void changePhoto(action) },
          ],
    );
  }
}

/** App language and recipe language dropdowns, stored on the device. */
function LanguageSection() {
  const t = useT();
  const appLanguage = useTortiePrefs((s) => s.appLanguage);
  const recipeLanguage = useTortiePrefs((s) => s.recipeLanguage);
  const set = useTortiePrefs((s) => s.set);
  return (
    <>
      <SectionLabel>{t('profile.language')}</SectionLabel>
      <View style={CARD}>
        <Select<AppLanguagePref>
          icon="language"
          label={t('profile.appLanguage')}
          sub={t('profile.appLanguageSub')}
          value={appLanguage}
          options={appLanguageOptions(t('profile.appLanguageSystem'))}
          onChange={(v) => set({ appLanguage: v })}
        />
        <View style={DIVIDER} />
        <Select<RecipeLanguagePref>
          icon="translate"
          label={t('profile.recipeLanguage')}
          sub={t('profile.recipeLanguageSub')}
          value={recipeLanguage}
          options={recipeLanguageOptions(t('profile.recipeLanguageOriginal'))}
          onChange={(v) => set({ recipeLanguage: v })}
        />
      </View>
    </>
  );
}

/** Device first, then each language under its own name. */
export function appLanguageOptions(
  systemLabel: string,
): SelectOption<AppLanguagePref>[] {
  return [
    { value: 'system', label: systemLabel },
    ...APP_LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
  ];
}

export function recipeLanguageOptions(
  originalLabel: string,
): SelectOption<RecipeLanguagePref>[] {
  return [
    { value: 'original', label: originalLabel },
    ...RECIPE_LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
  ];
}

type AboutRow = { icon: string; label: string; sub?: string; url?: string };

/** Version always; legal and support links only when configured for the build. */
export function aboutLinks(
  version = Constants.expoConfig?.version ?? '',
  env: Record<string, string | undefined> = {
    terms: process.env.EXPO_PUBLIC_TERMS_URL,
    privacy: process.env.EXPO_PUBLIC_PRIVACY_URL,
    support: process.env.EXPO_PUBLIC_SUPPORT_URL,
  },
): AboutRow[] {
  const rows: AboutRow[] = [
    { icon: 'notes', label: 'Version', sub: version || undefined },
  ];
  if (env.terms) rows.push({ icon: 'link', label: 'Terms', url: env.terms });
  if (env.privacy)
    rows.push({ icon: 'link', label: 'Privacy policy', url: env.privacy });
  if (env.support)
    rows.push({ icon: 'link', label: 'Support', url: env.support });
  return rows;
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
  onChangePhoto,
}: {
  on: boolean;
  heroHidden: boolean;
  user: TortieUser | null;
  name: string;
  onChangePhoto: () => void;
}) {
  const t = useT();
  const prefs = useTortiePrefs();
  const linked = useTortieAuth((s) => s.linked);
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

  const signOut = async () => {
    try {
      await authService.signOut();
      toast('Signed out');
    } catch {
      toast('Couldn’t sign out. Try again.', 'error');
    }
  };

  const link = async (k: 'google' | 'facebook') => {
    try {
      await authService.linkProvider(k);
      toast(`${PROV_NAME[k]} connected`);
    } catch (e) {
      const m = authMessage(e, `Couldn’t connect ${PROV_NAME[k]}. Try again.`);
      if (m) toast(m, 'error');
    }
  };

  const deleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, recipes, collections and plans. It can’t be undone.',
      [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.deleteAccount();
            } catch (e) {
              const m = authMessage(
                e,
                'Couldn’t delete your account. Try again.',
              );
              if (m) toast(m, 'error');
            }
          },
        },
      ],
    );

  const prov = user?.prov ?? 'email';
  const stats: [string, string][] = [
    [String(cooked.data?.meta.total ?? 0), 'meals cooked'],
    [String(recipes.total), 'recipes'],
    [String(colls.data?.items.length ?? 0), 'collections'],
  ];
  const aboutRows = aboutLinks();
  const cookRows: [string, string, string, boolean, () => void][] = [
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
          <Avatar
            size={96}
            serifInitials
            style={{ boxShadow: '0 0 0 4px #f8faf5, 0 0 0 6px #c7ecce' }}
          />
          <Press
            onPress={onChangePhoto}
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
        <SectionLabel>{t('profile.kitchen')}</SectionLabel>
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
              <T style={sans(15, 600)}>{t('profile.units')}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pill
                label={t('profile.metric')}
                on={prefs.units === 'metric'}
                onPress={() => prefs.set({ units: 'metric' })}
                height={32}
                paddingH={12}
                size={12}
                weight={700}
              />
              <Pill
                label={t('profile.imperial')}
                on={prefs.units === 'imperial'}
                onPress={() => prefs.set({ units: 'imperial' })}
                height={32}
                paddingH={12}
                size={12}
                weight={700}
              />
            </View>
          </View>
        </View>
      </Stagger>

      <Stagger i={3} on={on}>
        <LanguageSection />
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: C.surface3,
            }}
          >
            <Glyph name="schedule" size={22} color={C.green} />
            <RowText l="Snooze" sub="Added when a finished timer is snoozed" />
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <StepBtn
                icon="remove"
                label="Shorter snooze"
                onPress={() =>
                  prefs.set({
                    snoozeMinutes: clampSnooze(prefs.snoozeMinutes - 1),
                  })
                }
              />
              <T
                style={[
                  sans(16, 700),
                  {
                    minWidth: 44,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {prefs.snoozeMinutes + ' min'}
              </T>
              <StepBtn
                icon="add"
                label="Longer snooze"
                onPress={() =>
                  prefs.set({
                    snoozeMinutes: clampSnooze(prefs.snoozeMinutes + 1),
                  })
                }
              />
            </View>
          </View>
        </View>
      </Stagger>

      <Stagger i={4} on={on}>
        <SectionLabel>Help</SectionLabel>
        <Press
          onPress={() => useNav.getState().openWelcome()}
          scale={0.98}
          bg={C.white}
          pressedBg={C.surface2}
          style={[
            CARD,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 12,
            },
          ]}
        >
          <Glyph name="tour" size={22} color={C.green} />
          <RowText l="Take the tour" sub="A quick look at what Tortie can do" />
          <Glyph name="chevron_right" size={20} color={C.ink3} />
        </Press>
      </Stagger>

      <Stagger i={4} on={on}>
        <SectionLabel>About</SectionLabel>
        <View style={CARD}>
          {aboutRows.map((r, i) => (
            <Press
              key={r.label}
              onPress={() => r.url && void Linking.openURL(r.url)}
              disabled={!r.url}
              scale={0.98}
              bg={C.white}
              pressedBg={C.surface2}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 12,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: C.surface3,
              }}
            >
              <Glyph name={r.icon} size={22} color={C.green} />
              <RowText l={r.label} sub={r.sub} />
              {r.url ? (
                <Glyph name="chevron_right" size={20} color={C.ink3} />
              ) : null}
            </Press>
          ))}
        </View>
      </Stagger>

      <Stagger i={4} on={on}>
        <SectionLabel>Connected accounts</SectionLabel>
        <View style={CARD}>
          {(isFacebookEnabled() || linked.facebook
            ? (['google', 'facebook'] as const)
            : (['google'] as const)
          ).map((k, i) => {
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
                    onPress={() => void link(k)}
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
          onPress={() => void signOut()}
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
        <Press
          onPress={deleteAccount}
          scale={0.97}
          style={{
            height: 54,
            marginTop: 10,
            borderRadius: 99,
            borderWidth: 1.5,
            borderColor: C.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Glyph name="delete_forever" size={20} color={C.terraInk} />
          <T style={sans(15, 700, C.terraInk)}>Delete account</T>
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
