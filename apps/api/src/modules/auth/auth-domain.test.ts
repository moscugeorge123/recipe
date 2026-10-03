import {
  AuthErrorCode,
  AuthPhase,
  canUnlinkProvider,
  deriveAuthPhase,
  isRecentAuth,
  mapFirebaseAuthError,
  normalizeAuthError,
  normalizeEmail,
  normalizeUsername,
  planProviderLink,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@recipe/contracts';
import { describe, expect, it } from 'vitest';

import { HmacTokenVerifier, signTestToken } from './infrastructure/hmac-token.js';

const SECRET = 'domain-test-hmac-secret';

function futureExp(seconds = 120): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe('auth contract', () => {
  it('normalizes and validates usernames, including reserved names and whitespace', () => {
    expect(normalizeUsername('  Chef.Name  ')).toBe('chef.name');
    expect(validateUsername('good_name')).toMatchObject({
      ok: true,
      username: 'good_name',
      usernameNormalized: 'good_name',
    });
    expect(validateUsername('bad name').ok).toBe(false);
    expect(validateUsername('bad name')).toMatchObject({ code: AuthErrorCode.AUTH_USERNAME_INVALID });
    expect(validateUsername('ab').ok).toBe(false);
    expect(validateUsername('admin')).toMatchObject({ code: AuthErrorCode.AUTH_USERNAME_INVALID });
    expect(validateUsername('localhero', { extraReserved: ['LocalHero'] })).toMatchObject({
      code: AuthErrorCode.AUTH_USERNAME_INVALID,
    });
    expect(validateUsername('a..b').ok).toBe(false);
  });

  it('validates email and password', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(validateEmail('ada@example.com').ok).toBe(true);
    expect(validateEmail('not-an-email')).toMatchObject({ code: AuthErrorCode.AUTH_EMAIL_INVALID });
    expect(validatePassword('short')).toMatchObject({ code: AuthErrorCode.AUTH_PASSWORD_WEAK });
    expect(validatePassword('password1')).toMatchObject({ code: AuthErrorCode.AUTH_PASSWORD_WEAK });
    expect(validatePassword('correct-horse-battery').ok).toBe(true);
  });

  it('derives auth phases in priority order', () => {
    const ready = {
      initialized: true,
      hasFirebaseUser: true,
      appUserLoaded: true,
      username: 'ada',
      onboardingCompleted: true,
      emailVerificationBlocking: false,
      phoneVerificationBlocking: false,
    };
    expect(deriveAuthPhase({ ...ready, initialized: false })).toBe(AuthPhase.INITIALIZING);
    expect(deriveAuthPhase({ ...ready, failed: true })).toBe(AuthPhase.AUTHENTICATION_ERROR);
    expect(deriveAuthPhase({ ...ready, hasFirebaseUser: false })).toBe(AuthPhase.UNAUTHENTICATED);
    expect(deriveAuthPhase({ ...ready, appUserLoaded: false })).toBe(AuthPhase.AUTHENTICATED);
    expect(deriveAuthPhase({ ...ready, username: null })).toBe(
      AuthPhase.AUTHENTICATED_ONBOARDING_REQUIRED,
    );
    expect(deriveAuthPhase({ ...ready, onboardingCompleted: false })).toBe(
      AuthPhase.AUTHENTICATED_ONBOARDING_REQUIRED,
    );
    expect(deriveAuthPhase({ ...ready, emailVerificationBlocking: true })).toBe(
      AuthPhase.AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED,
    );
    expect(deriveAuthPhase({ ...ready, phoneVerificationBlocking: true })).toBe(
      AuthPhase.AUTHENTICATED_PHONE_VERIFICATION_REQUIRED,
    );
    expect(deriveAuthPhase(ready)).toBe(AuthPhase.AUTHENTICATED_READY);
  });

  it('maps Firebase auth errors to client-safe codes', () => {
    expect(mapFirebaseAuthError('auth/id-token-expired')).toBe(AuthErrorCode.AUTH_TOKEN_EXPIRED);
    expect(mapFirebaseAuthError('auth/credential-already-in-use')).toBe(
      AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE,
    );
    expect(mapFirebaseAuthError('auth/email-already-in-use')).toBe(
      AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
    );
    expect(mapFirebaseAuthError(undefined)).toBe(AuthErrorCode.AUTH_UNKNOWN_ERROR);
    expect(mapFirebaseAuthError('auth/not-a-real-code')).toBe(AuthErrorCode.AUTH_UNKNOWN_ERROR);
    const normalized = normalizeAuthError('auth/wrong-password');
    expect(normalized.code).toBe(AuthErrorCode.AUTH_WRONG_PASSWORD);
    expect(normalized.message.toLowerCase()).not.toContain('firebase');
  });

  it('plans provider links and refuses unlinking the last usable method', () => {
    expect(
      planProviderLink({ currentProviders: ['password'], incomingProvider: 'google.com' }),
    ).toEqual({ action: 'link' });
    expect(
      planProviderLink({ currentProviders: ['google.com'], incomingProvider: 'facebook.com' }),
    ).toEqual({ action: 'link' });
    expect(
      planProviderLink({ currentProviders: ['phone'], incomingProvider: 'password' }),
    ).toEqual({ action: 'link' });
    expect(
      planProviderLink({ currentProviders: ['google.com'], incomingProvider: 'google.com' }).action,
    ).toBe('already-linked');
    expect(
      planProviderLink({
        currentProviders: ['password'],
        incomingProvider: 'google.com',
        firebaseError: 'auth/credential-already-in-use',
      }).action,
    ).toBe('sign-in-then-link');
    expect(
      planProviderLink({
        currentProviders: ['password'],
        incomingProvider: 'google.com',
        firebaseError: 'auth/email-already-in-use',
      }).code,
    ).toBe(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS);

    expect(canUnlinkProvider(['password'], 'password')).toBe(false);
    expect(canUnlinkProvider(['password', 'google.com'], 'password')).toBe(true);
    expect(canUnlinkProvider(['anonymous', 'google.com'], 'google.com')).toBe(false);
    expect(canUnlinkProvider(['anonymous'], 'anonymous')).toBe(false);
    expect(canUnlinkProvider(['anonymous', 'password', 'phone'], 'phone')).toBe(true);
  });

  it('accepts a valid HMAC token and rejects expired, tampered, and wrong-secret tokens', async () => {
    const verifier = new HmacTokenVerifier(SECRET);
    const token = signTestToken(SECRET, {
      uid: 'user-1',
      email: 'ada@example.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      exp: futureExp(),
      firebase: { sign_in_provider: 'google.com' },
    });
    const identity = await verifier.verifyIdToken(token);
    expect(identity.uid).toBe('user-1');
    expect(identity.email).toBe('ada@example.com');
    expect(identity.emailVerified).toBe(true);
    expect(identity.signInProvider).toBe('google.com');
    expect(identity.providers).toEqual(['google.com']);

    const explicit = signTestToken(SECRET, {
      uid: 'user-2',
      exp: futureExp(),
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_provider: 'password' },
      providers: ['password', 'google.com'],
    });
    expect((await verifier.verifyIdToken(explicit)).providers).toEqual(['password', 'google.com']);

    const expired = signTestToken(SECRET, {
      uid: 'user-1',
      exp: Math.floor(Date.now() / 1000) - 10,
      auth_time: 1,
      firebase: { sign_in_provider: 'password' },
    });
    await expect(verifier.verifyIdToken(expired)).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_TOKEN_EXPIRED,
    });

    const [version, payload, signature] = token.split('.');
    const tampered = `${version}.${payload}.${signature?.slice(0, -2)}aa`;
    await expect(verifier.verifyIdToken(tampered)).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_TOKEN_INVALID,
    });

    const other = new HmacTokenVerifier('another-hmac-secret');
    await expect(other.verifyIdToken(token)).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_TOKEN_INVALID,
    });

    const missingUid = signTestToken(SECRET, { exp: futureExp() });
    await expect(verifier.verifyIdToken(missingUid)).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_TOKEN_INVALID,
    });
  });

  it('refuses to construct the HMAC verifier for production', () => {
    expect(() => new HmacTokenVerifier(SECRET, 'production')).toThrow(/production/);
  });

  it('treats auth_time outside the recent window as stale', () => {
    const now = Date.now();
    expect(isRecentAuth(Math.floor(now / 1000), now)).toBe(true);
    expect(isRecentAuth(Math.floor(now / 1000) - 301, now)).toBe(false);
    expect(isRecentAuth(0, now)).toBe(false);
  });
});
