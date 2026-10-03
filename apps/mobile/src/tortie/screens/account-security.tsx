import {
  AuthErrorCode,
  AuthProviderId,
  authErrorMessage,
  validatePassword,
  validatePhoneE164,
} from '@recipe/contracts';
import { useEffect, useState } from 'react';
import { View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { authService } from '@/auth/instance';
import { requiresEmailVerification } from '@/auth/services/auth.service';
import { useTortieAuth } from '@/tortie/auth-store';
import { toast } from '@/tortie/nav-store';
import { C, CSS_EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Collapse } from '@/tortie/ui/collapse';
import { Pill } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Input } from '@/tortie/ui/input';
import { ButtonSpinner } from '@/tortie/ui/keyframes';
import { Press } from '@/tortie/ui/press';
import { kicker, sans, T } from '@/tortie/ui/text';

const CARD = {
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.line,
  borderRadius: 18,
  paddingVertical: 2,
  paddingHorizontal: 16,
} as const;

const COUNTRIES: { dial: string; label: string }[] = [
  { dial: '+40', label: 'Romania' },
  { dial: '+1', label: 'United States' },
  { dial: '+44', label: 'United Kingdom' },
  { dial: '+49', label: 'Germany' },
  { dial: '+33', label: 'France' },
  { dial: '+39', label: 'Italy' },
  { dial: '+34', label: 'Spain' },
];

const RESEND_SECONDS = 60;

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message && !err.message.includes('auth/')) {
    return err.message;
  }
  return 'Something went wrong. Try again.';
}

function toE164(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  return `${dial}${digits}`;
}

export function AccountSecurity() {
  const user = useTortieAuth((s) => s.user);
  const linked = useTortieAuth((s) => s.linked);
  const setPendingPhone = useTortieAuth((s) => s.setPendingPhoneVerification);
  const emailVerified = Boolean(user?.emailVerified);
  const phoneVerified = Boolean(user?.phoneVerified);
  const needsEmail = requiresEmailVerification();

  return (
    <>
      <T
        style={[
          kicker(C.green),
          { marginTop: 26, marginBottom: 8, marginHorizontal: 4 },
        ]}
      >
        Login & security
      </T>
      <View style={CARD}>
        <EmailRow email={user?.email ?? ''} verified={emailVerified} />
        <View style={{ height: 1, backgroundColor: C.surface3 }} />
        <PasswordRow email={user?.email ?? ''} hasPassword={linked.password} />
        <View style={{ height: 1, backgroundColor: C.surface3 }} />
        <PhoneRow
          phone={user?.phoneNumber ?? ''}
          verified={phoneVerified}
          onPending={setPendingPhone}
        />
        <View style={{ height: 1, backgroundColor: C.surface3 }} />
        <DeleteRow
          email={user?.email ?? ''}
          hasPassword={linked.password}
          hasGoogle={linked.google}
          hasFacebook={linked.facebook}
          needsEmail={needsEmail}
        />
      </View>
    </>
  );
}

function EmailRow({ email, verified }: { email: string; verified: boolean }) {
  const [busy, setBusy] = useState(false);
  const resend = () => {
    if (busy) return;
    setBusy(true);
    void authService
      .sendEmailVerification()
      .then(() => toast('Verification email sent'))
      .catch((err: unknown) => toast(messageOf(err)))
      .finally(() => setBusy(false));
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
      }}
    >
      <Glyph name="mail" size={22} color={C.green} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={sans(15, 600)}>Email</T>
        <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
          {email
            ? verified
              ? `${email} · Verified`
              : `${email} · Unverified`
            : 'No email on this account'}
        </T>
      </View>
      {email && !verified ? (
        <Press
          onPress={resend}
          scale={0.94}
          pressedBg={C.greenWash3}
          bg="transparent"
          style={outlineBtn}
        >
          {busy ? (
            <ButtonSpinner color={C.green} />
          ) : (
            <T style={sans(13, 700, C.green)}>Resend</T>
          )}
        </Press>
      ) : null}
    </View>
  );
}

function PasswordRow({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = () => {
    if (busy) return;
    const checked = validatePassword(next);
    if (!checked.ok) {
      setErr(checked.message);
      return;
    }
    if (next !== confirm) {
      setErr('Those passwords don’t match.');
      return;
    }
    setBusy(true);
    setErr('');
    const run = hasPassword
      ? authService
          .reauthenticate({ kind: 'password', email, password: current })
          .then(() => authService.updatePassword(next))
      : authService.linkEmailPassword(email, next);
    void run
      .then(() => {
        setOpen(false);
        setCurrent('');
        setNext('');
        setConfirm('');
        toast(hasPassword ? 'Password changed' : 'Password set');
      })
      .catch((error: unknown) => setErr(messageOf(error)))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Glyph name="lock" size={22} color={C.green} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(15, 600)}>Password</T>
          <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
            {hasPassword ? 'Change the password on this account' : 'Set a password'}
          </T>
        </View>
        <Press
          onPress={() => setOpen((value) => !value)}
          scale={0.94}
          pressedBg={C.greenWash3}
          bg="transparent"
          style={outlineBtn}
        >
          <T style={sans(13, 700, C.green)}>{hasPassword ? 'Change' : 'Set'}</T>
        </Press>
      </View>
      <Collapse open={open}>
        <View style={{ gap: 10, paddingTop: 12 }}>
          {hasPassword ? (
            <SecurityField
              value={current}
              onChangeText={(value) => (setCurrent(value), setErr(''))}
              placeholder="Current password"
              secureTextEntry
              accessibilityLabel="Current password"
            />
          ) : null}
          <SecurityField
            value={next}
            onChangeText={(value) => (setNext(value), setErr(''))}
            placeholder="New password"
            secureTextEntry
            accessibilityLabel="New password"
          />
          <SecurityField
            value={confirm}
            onChangeText={(value) => (setConfirm(value), setErr(''))}
            placeholder="Type it once more"
            secureTextEntry
            accessibilityLabel="Confirm password"
          />
          {err ? <InlineError text={err} /> : null}
          <Press onPress={save} scale={0.97} style={greenBtn}>
            {busy ? (
              <ButtonSpinner />
            ) : (
              <T style={sans(15, 700, C.bg)}>
                {hasPassword ? 'Change password' : 'Set password'}
              </T>
            )}
          </Press>
        </View>
      </Collapse>
    </View>
  );
}

function PhoneRow({
  phone,
  verified,
  onPending,
}: {
  phone: string;
  verified: boolean;
  onPending: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dial, setDial] = useState('+40');
  const [national, setNational] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const send = () => {
    if (busy || cooldown > 0) return;
    const e164 = toE164(dial, national);
    const checked = validatePhoneE164(e164);
    if (!checked.ok) {
      setErr(checked.message);
      return;
    }
    setBusy(true);
    setErr('');
    void authService
      .startPhoneVerification(checked.e164 ?? e164)
      .then(({ verificationId: id }) => {
        setVerificationId(id);
        setCode('');
        setCooldown(RESEND_SECONDS);
        onPending(true);
        setOpen(true);
      })
      .catch((error: unknown) => setErr(messageOf(error)))
      .finally(() => setBusy(false));
  };

  const confirm = () => {
    if (busy) return;
    if (!verificationId || code.trim().length < 4) {
      setErr('That code doesn’t match. Try again.');
      return;
    }
    setBusy(true);
    setErr('');
    void authService
      .confirmPhoneVerification(verificationId, code.trim())
      .then(() => {
        setCode('');
        setVerificationId('');
        onPending(false);
        setOpen(false);
        toast('Phone verified');
      })
      .catch((error: unknown) => setErr(messageOf(error)))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Glyph name="smartphone" size={22} color={C.green} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(15, 600)}>Phone</T>
          <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
            {verified ? `${phone || 'Verified'} · Verified` : 'Not verified'}
          </T>
        </View>
        {verified ? (
          <Glyph name="check_circle" size={24} color={C.green} fill />
        ) : (
          <Press
            onPress={() => setOpen((value) => !value)}
            scale={0.94}
            pressedBg={C.greenWash3}
            bg="transparent"
            style={outlineBtn}
          >
            <T style={sans(13, 700, C.green)}>{open ? 'Close' : 'Verify'}</T>
          </Press>
        )}
      </View>
      {verified ? null : (
        <Collapse open={open}>
          <View style={{ gap: 10, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {COUNTRIES.map((country) => (
                <Pill
                  key={country.dial}
                  label={country.dial}
                  on={dial === country.dial}
                  onPress={() => setDial(country.dial)}
                  height={32}
                  paddingH={12}
                  size={12}
                  weight={700}
                />
              ))}
            </View>
            <SecurityField
              value={national}
              onChangeText={(value) => (setNational(value), setErr(''))}
              placeholder="712 345 678"
              keyboardType="phone-pad"
              accessibilityLabel="Phone number"
            />
            <Press onPress={send} scale={0.97} style={greenBtn}>
              {busy && !verificationId ? (
                <ButtonSpinner />
              ) : (
                <T style={sans(15, 700, C.bg)}>Send code</T>
              )}
            </Press>
            {verificationId ? (
              <>
                <SecurityField
                  value={code}
                  onChangeText={(value) => (setCode(value), setErr(''))}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  accessibilityLabel="Verification code"
                />
                <Press onPress={confirm} scale={0.97} style={greenBtn}>
                  {busy ? (
                    <ButtonSpinner />
                  ) : (
                    <T style={sans(15, 700, C.bg)}>Confirm code</T>
                  )}
                </Press>
                <T style={sans(12, 400, C.ink2)}>
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : 'You can resend the code.'}
                </T>
                {cooldown === 0 ? (
                  <Press
                    onPress={send}
                    style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
                  >
                    <T style={sans(13, 700, C.green)}>Resend code</T>
                  </Press>
                ) : null}
              </>
            ) : null}
            {err ? <InlineError text={err} /> : null}
            <Press
              onPress={() => {
                setOpen(false);
                onPending(false);
              }}
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            >
              <T style={sans(13, 600, C.ink2)}>Cancel</T>
            </Press>
          </View>
        </Collapse>
      )}
    </View>
  );
}

function DeleteRow({
  email,
  hasPassword,
  hasGoogle,
  hasFacebook,
  needsEmail,
}: {
  email: string;
  hasPassword: boolean;
  hasGoogle: boolean;
  hasFacebook: boolean;
  needsEmail: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = () => {
    if (busy) return;
    if (phrase !== 'DELETE') {
      setErr('Type DELETE to confirm.');
      return;
    }
    setBusy(true);
    setErr('');
    const reauth = hasPassword
      ? authService.reauthenticate({ kind: 'password', email, password })
      : hasGoogle
        ? authService.reauthenticate({ kind: 'google' })
        : hasFacebook
          ? authService.reauthenticate({ kind: 'facebook' })
          : Promise.reject(
              new Error(authErrorMessage(AuthErrorCode.AUTH_REQUIRES_RECENT_LOGIN)),
            );
    void reauth
      .then(() => authService.deleteAccount())
      .then(() => toast('Account deleted'))
      .catch((error: unknown) => setErr(messageOf(error)))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ paddingVertical: 12 }}>
      <Press
        onPress={() => setOpen(true)}
        scale={0.98}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Glyph name="delete" size={22} color={C.terraInk} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(15, 700, C.terraInk)}>Delete account</T>
          <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
            {needsEmail
              ? 'Verify your email, then confirm with a recent sign-in.'
              : 'Permanently remove your account'}
          </T>
        </View>
      </Press>
      <Collapse open={open}>
        <View style={{ gap: 10, paddingTop: 12 }}>
          <T style={[sans(13, 400, C.ink2), { lineHeight: 18 }]}>
            This permanently deletes your account. Type DELETE to confirm.
          </T>
          {hasPassword ? (
            <SecurityField
              value={password}
              onChangeText={(value) => (setPassword(value), setErr(''))}
              placeholder="Current password"
              secureTextEntry
              accessibilityLabel="Current password"
            />
          ) : null}
          <SecurityField
            value={phrase}
            onChangeText={(value) => (setPhrase(value), setErr(''))}
            placeholder="Type DELETE"
            autoCapitalize="characters"
            accessibilityLabel="Type DELETE"
          />
          {err ? <InlineError text={err} /> : null}
          <Press
            onPress={remove}
            scale={0.97}
            style={{
              height: 54,
              borderRadius: 99,
              borderWidth: 1.5,
              borderColor: C.terraSoft,
              backgroundColor: C.terraWash,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {busy ? (
              <ButtonSpinner color={C.terraInk} />
            ) : (
              <T style={sans(15, 700, C.terraInk)}>Delete my account</T>
            )}
          </Press>
        </View>
      </Collapse>
    </View>
  );
}

function InlineError({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
      <Glyph name="error" size={16} color={C.terra} />
      <T style={[sans(13, 600, C.terra), { flex: 1, lineHeight: 18 }]}>{text}</T>
    </View>
  );
}

function SecurityField(props: TextInputProps) {
  const [focus, setFocus] = useState(false);
  const a = useAnimatedStyle(() => ({
    borderColor: tw(focus ? C.green : C.line, 200, CSS_EASE),
  }));
  return (
    <Animated.View
      style={[
        {
          height: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          backgroundColor: C.white,
          justifyContent: 'center',
        },
        a,
      ]}
    >
      <Input
        {...props}
        allowFontScaling={false}
        placeholderTextColor={C.ink3}
        onFocus={(event) => {
          setFocus(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocus(false);
          props.onBlur?.(event);
        }}
        style={[sans(16, 400), { height: 54, paddingHorizontal: 18 }]}
      />
    </Animated.View>
  );
}

const outlineBtn = {
  height: 34,
  paddingHorizontal: 14,
  borderRadius: 99,
  borderWidth: 1,
  borderColor: C.green,
  justifyContent: 'center',
} as const;

const greenBtn = {
  height: 54,
  borderRadius: 99,
  backgroundColor: C.green,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
