import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useCollections } from '@/features/collections/hooks';
import {
  firstName,
  useTortieAuth,
  type AuthProv,
  type TortieUser,
} from '@/tortie/auth-store';
import { useTRecipes } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { motionMultiplier, useMotion } from '@/tortie/motion';
import { toast, useNav, type AuthStep } from '@/tortie/nav-store';
import { C, CSS_EASE, SH } from '@/tortie/theme';
import { tw, useOpenProgress, useSlideUp } from '@/tortie/ui/anim';
import { DoneArt, OAuthArt, TORTIE_LOGO } from '@/tortie/ui/art';
import { BrandLogo } from '@/tortie/ui/brand';
import { Segmented } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Input, KeyboardScroll } from '@/tortie/ui/input';
import { ButtonSpinner, Dots } from '@/tortie/ui/keyframes';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const RANK: Record<AuthStep, number> = {
  start: 0,
  pw: 1,
  signup: 1,
  oauth: 1,
  done: 2,
};
const PROV = { google: 'Google', facebook: 'Facebook' } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STR: [string, string][] = [
  ['', C.lineStrong],
  ['Weak', C.terra],
  ['Okay', C.terraBright],
  ['Good', C.greenMid],
  ['Strong', C.green],
];

/** "elena.moretti@…" → "Elena Moretti" (the API has no account lookup yet). */
function nameFromEmail(email: string): string {
  return email
    .split('@')[0]!
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function SignInFlow() {
  const f = useFrame();
  const { m } = useMotion();
  const au = useNav((s) => s.au);
  const step = useNav((s) => s.auStep);
  const mode = useNav((s) => s.auMode);
  const prov = useNav((s) => s.auProv);
  const set = useNav((s) => s.set);
  const user = useTortieAuth((s) => s.user);
  const recipes = useTRecipes();
  const colls = useCollections();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [returning, setReturning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) =>
    timers.current.push(setTimeout(fn, ms));

  const finish = (u: TortieUser, back: boolean) => {
    setBusy(false);
    setReturning(back);
    useTortieAuth.getState().signIn(u);
    set({ auStep: 'done', pfOut: true });
  };

  const runOauth = (p: 'google' | 'facebook') => {
    clear();
    setStage(0);
    setErr('');
    set({ auStep: 'oauth', auProv: p });
    const mm = motionMultiplier();
    later(Math.max(500, 1100 * mm), () => setStage(1));
    later(Math.max(900, 2300 * mm), () =>
      finish({ name: '', email: '', prov: p as AuthProv, img: false }, true),
    );
  };

  // Opening resets the form; opening straight onto a provider starts Connecting.
  const runOauthRef = useRef(runOauth);
  useEffect(() => {
    runOauthRef.current = runOauth;
  });
  useEffect(
    () =>
      useNav.subscribe((s, prev) => {
        if (!s.au || prev.au) return;
        clear();
        setErr('');
        setPw('');
        setBusy(false);
        setShow(false);
        if (s.auStep === 'oauth') runOauthRef.current(s.auProv);
      }),
    [],
  );
  useEffect(() => clear, []);

  const close = () => {
    clear();
    const done = useNav.getState().auStep === 'done';
    setBusy(false);
    set({ au: false });
    if (done) {
      setTimeout(
        () => set({ pfOut: false }),
        Math.round(300 * motionMultiplier()),
      );
      const first = firstName(useTortieAuth.getState().user);
      toast(first === 'there' ? 'Welcome to Tortie' : `Welcome, ${first}`);
    }
  };
  const back = () => {
    clear();
    setErr('');
    setBusy(false);
    set({ auStep: 'start' });
  };

  const emOk = EMAIL_RE.test(email.trim());
  const isLogin = mode === 'login';
  const cont = () => {
    if (!emOk) {
      setErr('Enter a valid email address, like you@example.com.');
      return;
    }
    setErr('');
    setPw('');
    setShow(false);
    set({ auStep: isLogin ? 'pw' : 'signup' });
  };
  const login = () => {
    if (busy) return;
    if (pw.length < 6) {
      setErr('That password doesn’t match this email. Try again or reset it.');
      return;
    }
    setBusy(true);
    setErr('');
    later(1100, () =>
      finish(
        {
          name: nameFromEmail(email.trim()),
          email: email.trim(),
          prov: 'email',
          img: false,
        },
        true,
      ),
    );
  };
  const create = () => {
    if (busy) return;
    if (!name.trim()) {
      setErr('Add your name so the people you cook with know it’s you.');
      return;
    }
    if (pw.length < 8) {
      setErr('Passwords need at least 8 characters.');
      return;
    }
    setBusy(true);
    setErr('');
    later(1200, () =>
      finish(
        {
          name: name.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
          email: email.trim(),
          prov: 'email',
          img: false,
        },
        false,
      ),
    );
  };

  const scN = pw
    ? [
        pw.length >= 8,
        /\d/.test(pw),
        /[A-Z]/.test(pw) && /[a-z]/.test(pw),
        /[^A-Za-z0-9]/.test(pw),
      ].filter(Boolean).length
    : 0;
  const scB = pw ? Math.max(1, scN) : 0;
  const [strLabel, strCol] = STR[scB]!;
  const strHint =
    pw.length < 8
      ? 'Use 8+ characters'
      : scN < 4
        ? 'Add a number, capital or symbol'
        : 'Great password';

  const backable = step === 'pw' || step === 'signup' || step === 'oauth';
  const open = useOpenProgress(au, Math.round(560 * m));
  const slide = useSlideUp(open);
  const backSt = useAnimatedStyle(() => ({
    opacity: tw(backable ? 1 : 0, 240, CSS_EASE),
    transform: [{ translateX: tw(backable ? 0 : -8, 320) }],
  }));
  const closeSt = useAnimatedStyle(() => ({
    opacity: tw(step === 'done' ? 0 : 1, 240, CSS_EASE),
  }));

  const createFade = useFade(name.trim() && pw.length >= 8 ? 1 : 0.45);
  const first = firstName(user);
  const P = prov === 'facebook' ? 'facebook' : 'google';

  return (
    <Animated.View
      pointerEvents={au ? 'auto' : 'none'}
      onLayout={slide.onLayout}
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 56,
          backgroundColor: C.bg,
          overflow: 'hidden',
          boxShadow: SH.modalTop,
        },
        slide.style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: f.pushTop,
          left: 16,
          right: 16,
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 3,
        }}
      >
        <Animated.View
          style={backSt}
          pointerEvents={backable ? 'auto' : 'none'}
        >
          <Press
            onPress={back}
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
        </Animated.View>
        <Animated.View
          style={closeSt}
          pointerEvents={step === 'done' ? 'none' : 'auto'}
        >
          <Press
            onPress={close}
            scale={0.9}
            accessibilityLabel="Close"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: C.surface3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="close" size={20} color={C.ink} />
          </Press>
        </Animated.View>
      </View>

      <Panel k="start" cur={step} scroll top={f.pushTop + 52}>
        <Image
          source={TORTIE_LOGO}
          style={{ width: 52, height: 52, borderRadius: 15 }}
          contentFit="cover"
        />
        <T
          style={[
            serif(34, 500),
            { letterSpacing: em(34, -0.02), lineHeight: 36.7, marginTop: 18 },
          ]}
        >
          {isLogin ? 'Welcome back' : 'Create your account'}
        </T>
        <T
          style={[
            sans(14, 400, C.ink2),
            { lineHeight: 21, marginTop: 8, minHeight: 42 },
          ]}
        >
          {isLogin
            ? 'Log in to pick up where you left off — your plan and groceries are waiting.'
            : 'Save recipes, plan the week and share collections with the people you cook with.'}
        </T>
        <Segmented
          style={{ marginTop: 20 }}
          index={isLogin ? 1 : 0}
          items={[
            {
              label: 'Sign up',
              onPress: () => (set({ auMode: 'signup' }), setErr('')),
            },
            {
              label: 'Log in',
              onPress: () => (set({ auMode: 'login' }), setErr('')),
            },
          ]}
        />
        <View style={{ gap: 10, marginTop: 20 }}>
          <OutlineBtn onPress={() => runOauth('google')}>
            <BrandLogo brand="google" size={20} />
            <T style={sans(15, 700)}>Continue with Google</T>
          </OutlineBtn>
          <OutlineBtn onPress={() => runOauth('facebook')}>
            <BrandLogo brand="facebook" size={20} />
            <T style={sans(15, 700)}>Continue with Facebook</T>
          </OutlineBtn>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 20,
            marginBottom: 16,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
          <T
            style={[
              sans(12, 700, C.ink3),
              { letterSpacing: em(12, 0.08), textTransform: 'uppercase' },
            ]}
          >
            or with email
          </T>
          <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
        </View>
        <Field
          value={email}
          onChangeText={(v) => (setEmail(v), setErr(''))}
          onSubmitEditing={cont}
          placeholder="you@example.com"
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="Email"
          error={!!err}
        />
        <ErrorLine err={step === 'start' ? err : ''} />
        <PrimaryBtn
          onPress={cont}
          opacity={emOk ? 1 : 0.45}
          style={{ marginTop: 12 }}
        >
          <T style={sans(15, 700, C.bg)}>Continue</T>
          <Glyph name="arrow_forward" size={20} color={C.bg} />
        </PrimaryBtn>
        <View style={{ flex: 1, minHeight: 20 }} />
        <T
          style={[
            sans(12, 400, C.ink3),
            { lineHeight: 18, textAlign: 'center' },
          ]}
        >
          By continuing you agree to Tortie’s{' '}
          <T style={sans(12, 400, C.green)}>Terms</T> and{' '}
          <T style={sans(12, 400, C.green)}>Privacy Policy</T>.
        </T>
      </Panel>

      <Panel k="pw" cur={step} scroll top={f.pushTop + 64}>
        <T
          style={[
            serif(34, 500),
            { letterSpacing: em(34, -0.02), lineHeight: 36.7 },
          ]}
        >
          Enter your password
        </T>
        <Press
          onPress={back}
          scale={0.96}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 36,
            marginTop: 14,
            paddingLeft: 12,
            paddingRight: 8,
            borderRadius: 99,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.white,
          }}
        >
          <Glyph name="mail" size={17} color={C.green} />
          <T style={sans(13, 600)}>{email.trim()}</T>
          <Glyph name="edit" size={16} color={C.ink3} />
        </Press>
        <View style={{ marginTop: 24 }}>
          <Field
            value={pw}
            onChangeText={(v) => (setPw(v), setErr(''))}
            onSubmitEditing={login}
            placeholder="Password"
            autoComplete="current-password"
            secureTextEntry={!show}
            accessibilityLabel="Password"
            error={!!err}
            padRight
          />
          <Eye show={show} onPress={() => setShow((v) => !v)} />
        </View>
        <ErrorLine err={step === 'pw' ? err : ''} />
        <Press
          onPress={() =>
            toast('Reset link sent to ' + (email.trim() || 'your inbox'))
          }
          style={{
            alignSelf: 'flex-start',
            paddingVertical: 12,
            paddingHorizontal: 2,
          }}
        >
          <T style={sans(14, 700, C.green)}>Forgot password?</T>
        </Press>
        <PrimaryBtn
          onPress={login}
          opacity={pw ? 1 : 0.45}
          style={{ marginTop: 8 }}
        >
          {busy ? <ButtonSpinner /> : <T style={sans(15, 700, C.bg)}>Log in</T>}
        </PrimaryBtn>
      </Panel>

      <Panel k="signup" cur={step} scroll top={f.pushTop + 64}>
        <T
          style={[
            serif(34, 500),
            { letterSpacing: em(34, -0.02), lineHeight: 36.7 },
          ]}
        >
          Nearly there
        </T>
        <T style={[sans(14, 400, C.ink2), { lineHeight: 21, marginTop: 8 }]}>
          Creating an account for{' '}
          <T style={sans(14, 700, C.ink)}>{email.trim()}</T>
        </T>
        <T style={[sans(13, 700, C.ink2), { marginTop: 24, marginBottom: 8 }]}>
          Your name
        </T>
        <Field
          value={name}
          onChangeText={(v) => (setName(v), setErr(''))}
          placeholder="What should we call you?"
          autoComplete="name"
          accessibilityLabel="Your name"
        />
        <T style={[sans(13, 700, C.ink2), { marginTop: 18, marginBottom: 8 }]}>
          Password
        </T>
        <View>
          <Field
            value={pw}
            onChangeText={(v) => (setPw(v), setErr(''))}
            onSubmitEditing={create}
            placeholder="8 characters or more"
            autoComplete="new-password"
            secureTextEntry={!show}
            accessibilityLabel="New password"
            padRight
          />
          <Eye show={show} onPress={() => setShow((v) => !v)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <StrengthBar key={i} on={i <= scB} color={strCol} />
          ))}
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 8,
          }}
        >
          <T style={sans(12, 400, C.ink2)}>{strHint}</T>
          <StrengthLabel label={strLabel} color={strCol} />
        </View>
        <ErrorLine err={step === 'signup' ? err : ''} pt={10} />
        <Press
          onPress={create}
          scale={0.97}
          style={{
            height: 54,
            marginTop: 22,
            borderRadius: 99,
            backgroundColor: C.terra,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: SH.terraCta,
          }}
          animatedStyle={createFade}
        >
          {busy ? (
            <ButtonSpinner />
          ) : (
            <T style={sans(15, 700, C.white)}>Create account</T>
          )}
        </Press>
      </Panel>

      <Panel k="oauth" cur={step} center top={f.pushTop + 52} bottom={40}>
        <View
          style={{ height: 80, flexDirection: 'row', alignItems: 'center' }}
        >
          {step === 'oauth' ? <OAuthArt brand={P} /> : null}
        </View>
        <T
          style={[
            serif(30, 500),
            {
              letterSpacing: em(30, -0.015),
              lineHeight: 33,
              marginTop: 30,
              textAlign: 'center',
            },
          ]}
        >{`Connecting to ${PROV[P]}`}</T>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 10,
            minHeight: 22,
            alignItems: 'center',
          }}
        >
          <T style={sans(15, 600, C.ink2)}>
            {stage ? 'Confirming it’s you' : `Opening ${PROV[P]}`}
          </T>
          <Dots textStyle={sans(15, 600, C.ink2)} />
        </View>
        <T
          style={[
            sans(13, 400, C.ink3),
            {
              lineHeight: 19.5,
              marginTop: 14,
              maxWidth: 280,
              textAlign: 'center',
            },
          ]}
        >
          {`Tortie only sees your name, email and photo. We never post anything to your ${PROV[P]} account.`}
        </T>
        <Press
          onPress={back}
          scale={0.96}
          style={{
            marginTop: 32,
            height: 44,
            paddingHorizontal: 20,
            borderRadius: 99,
            borderWidth: 1.5,
            borderColor: C.line,
            justifyContent: 'center',
          }}
        >
          <T style={sans(14, 600)}>Cancel</T>
        </Press>
      </Panel>

      <Panel
        k="done"
        cur={step}
        top={f.pushTop + 52}
        bottom={Math.max(34, f.bottom)}
        alignCenter
      >
        <View style={{ flex: 1 }} />
        <View
          style={{ height: 140, flexDirection: 'row', alignItems: 'center' }}
        >
          {step === 'done' ? <DoneArt /> : null}
        </View>
        <T
          style={[
            serif(34, 500),
            {
              letterSpacing: em(34, -0.02),
              lineHeight: 36.7,
              marginTop: 18,
              textAlign: 'center',
            },
          ]}
        >
          {first === 'there' ? 'You’re in' : `You’re in, ${first}`}
        </T>
        <T
          style={[
            sans(15, 400, C.ink2),
            {
              lineHeight: 22.5,
              marginTop: 10,
              maxWidth: 300,
              textAlign: 'center',
            },
          ]}
        >
          {returning
            ? 'Welcome back. Your recipes, plan and pantry are synced to this phone.'
            : `Your ${recipes.total} recipes and ${colls.data?.items.length ?? 0} collections are now saved to your account.`}
        </T>
        <View style={{ flex: 1 }} />
        <Press
          onPress={close}
          scale={0.97}
          style={{
            alignSelf: 'stretch',
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
          <Glyph name="local_fire_department" size={20} color={C.white} />
          <T style={sans(15, 700, C.white)}>Back to the kitchen</T>
        </Press>
      </Panel>
    </Animated.View>
  );
}

function useFade(o: number) {
  return useAnimatedStyle(() => ({ opacity: tw(o, 240, CSS_EASE) }));
}

/**
 * Sign-in panel: enters from ±40px over AD (440ms × m) with opacity over
 * AD × .6 after AD × .25; leaves to ∓40px with no delay.
 */
function Panel({
  k,
  cur,
  children,
  scroll,
  center,
  alignCenter,
  top,
  bottom = 30,
}: {
  k: AuthStep;
  cur: AuthStep;
  children: ReactNode;
  scroll?: boolean;
  center?: boolean;
  alignCenter?: boolean;
  top: number;
  bottom?: number;
}) {
  const { m } = useMotion();
  const AD = Math.round(440 * m);
  const on = k === cur;
  const x = on ? 0 : RANK[k] < RANK[cur] ? -40 : 40;
  const a = useAnimatedStyle(() => ({
    opacity: tw(
      on ? 1 : 0,
      Math.round(AD * 0.6),
      undefined,
      on ? Math.round(AD * 0.25) : 0,
    ),
    transform: [{ translateX: tw(x, AD) }],
  }));
  const pad = { paddingTop: top, paddingHorizontal: 24, paddingBottom: bottom };
  return (
    <Animated.View
      pointerEvents={on ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, a]}
    >
      {scroll ? (
        <KeyboardScroll
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[pad, { flexGrow: 1 }]}
        >
          {children}
        </KeyboardScroll>
      ) : (
        <View
          style={[
            { flex: 1 },
            pad,
            center ? { alignItems: 'center', justifyContent: 'center' } : null,
            alignCenter ? { alignItems: 'center' } : null,
          ]}
        >
          {children}
        </View>
      )}
    </Animated.View>
  );
}

function Field({
  error,
  padRight,
  ...props
}: TextInputProps & { error?: boolean; padRight?: boolean }) {
  const [focus, setFocus] = useState(false);
  const box = useRef<View>(null);
  const a = useAnimatedStyle(() => ({
    borderColor: tw(focus ? C.green : error ? C.terra : C.line, 200, CSS_EASE),
  }));
  return (
    <Animated.View
      ref={box}
      style={[
        {
          height: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          backgroundColor: C.white,
          justifyContent: 'center',
          boxShadow: focus ? SH.focus : undefined,
        },
        a,
      ]}
    >
      <Input
        {...props}
        revealRef={box}
        allowFontScaling={false}
        placeholderTextColor={C.ink3}
        onFocus={(e) => (setFocus(true), props.onFocus?.(e))}
        onBlur={(e) => (setFocus(false), props.onBlur?.(e))}
        style={[
          sans(16, 400),
          {
            height: 54,
            paddingLeft: 18,
            paddingRight: padRight ? 54 : 18,
            outlineStyle: 'none',
          } as object,
        ]}
      />
    </Animated.View>
  );
}

function Eye({ show, onPress }: { show: boolean; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Show password"
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph
        name={show ? 'visibility_off' : 'visibility'}
        size={21}
        color={C.ink2}
      />
    </Press>
  );
}

/** Error text: max-height 0 → 60 (320ms EASE) + opacity 200ms. Keeps the last message while collapsing. */
function ErrorLine({ err, pt = 8 }: { err: string; pt?: number }) {
  const [shown, setShown] = useState(err);
  if (err && err !== shown) setShown(err);
  const a = useAnimatedStyle(() => ({
    maxHeight: tw(err ? 60 : 0, 320),
    opacity: tw(err ? 1 : 0, 200, CSS_EASE),
  }));
  return (
    <Animated.View style={[{ overflow: 'hidden' }, a]}>
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          alignItems: 'flex-start',
          paddingTop: pt,
        }}
      >
        <Glyph name="error" size={16} color={C.terra} />
        <T style={[sans(13, 600, C.terra), { flex: 1, lineHeight: 18 }]}>
          {shown}
        </T>
      </View>
    </Animated.View>
  );
}

function StrengthBar({ on, color }: { on: boolean; color: string }) {
  const [w, setW] = useState(0);
  const a = useAnimatedStyle(() => ({
    width: tw(on ? w : 0, 360),
    backgroundColor: tw(color, 300, CSS_EASE),
  }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{
        flex: 1,
        height: 5,
        borderRadius: 3,
        backgroundColor: C.line,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ height: '100%', borderRadius: 3 }, a]} />
    </View>
  );
}

function StrengthLabel({ label, color }: { label: string; color: string }) {
  const a = useAnimatedStyle(() => ({ color: tw(color, 300, CSS_EASE) }));
  return (
    <Animated.Text allowFontScaling={false} style={[sans(12, 700), a]}>
      {label}
    </Animated.Text>
  );
}

function OutlineBtn({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.97}
      bg={C.white}
      pressedBg={C.surface2}
      style={{
        height: 54,
        borderRadius: 99,
        borderWidth: 1.5,
        borderColor: C.line,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {children}
    </Press>
  );
}

function PrimaryBtn({
  onPress,
  opacity,
  style,
  children,
}: {
  onPress: () => void;
  opacity: number;
  style?: object;
  children: ReactNode;
}) {
  const fade = useFade(opacity);
  return (
    <Press
      onPress={onPress}
      scale={0.97}
      animatedStyle={fade}
      style={[
        {
          height: 54,
          borderRadius: 99,
          backgroundColor: C.green,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      {children}
    </Press>
  );
}
