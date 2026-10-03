import { createHmac, timingSafeEqual } from 'node:crypto';

import { AuthErrorCode } from '@recipe/contracts';

import { AuthAppError } from '../../../shared/errors/app-error.js';
import type { TokenVerifier, VerifiedIdentity } from '../domain/token.js';

/**
 * Shared test secret. Selected only when NODE_ENV=test and no AUTH_HMAC_SECRET is set.
 * Never use this value in a deployed environment.
 */
export const TEST_HMAC_SECRET = 'test-only-auth-hmac-secret-not-for-production';

function signPayload(secret: string, payloadSegment: string): Buffer {
  return createHmac('sha256', secret).update(payloadSegment).digest();
}

function readSignInProvider(payload: Record<string, unknown>): string {
  const firebase = payload.firebase;
  if (!firebase || typeof firebase !== 'object') return '';
  const provider = (firebase as Record<string, unknown>).sign_in_provider;
  return typeof provider === 'string' ? provider : '';
}

function readProviders(payload: Record<string, unknown>, signInProvider: string): string[] {
  const raw = payload.providers;
  if (Array.isArray(raw) && raw.every((entry) => typeof entry === 'string')) {
    return [...raw];
  }
  return signInProvider ? [signInProvider] : [];
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function identityFromPayload(payload: Record<string, unknown>): VerifiedIdentity {
  const uid = payload.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
  }

  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
  }
  if (exp * 1000 <= Date.now()) {
    throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_EXPIRED);
  }

  const signInProvider = readSignInProvider(payload);
  const authTime = typeof payload.auth_time === 'number' && Number.isFinite(payload.auth_time)
    ? payload.auth_time
    : 0;

  return {
    uid,
    email: readNullableString(payload.email),
    emailVerified: payload.email_verified === true,
    phoneNumber: readNullableString(payload.phone_number),
    authTime,
    expiresAt: exp,
    signInProvider,
    providers: readProviders(payload, signInProvider),
  };
}

/**
 * Signs a test ID token: `v1.` + base64url(json) + `.` + base64url(hmac-sha256(payload)).
 * The signature covers the payload segment only. This is not a Firebase token.
 */
export function signTestToken(secret: string, claims: Record<string, unknown>): string {
  const payloadSegment = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = signPayload(secret, payloadSegment).toString('base64url');
  return `v1.${payloadSegment}.${signature}`;
}

/**
 * Dev/test token verifier. Construction throws when `nodeEnv` is `production` so this
 * implementation cannot be selected as the production verifier.
 */
export class HmacTokenVerifier implements TokenVerifier {
  constructor(
    private readonly secret: string,
    nodeEnv: string = process.env.NODE_ENV ?? 'development',
  ) {
    if (secret.length === 0) {
      throw new Error('HMAC auth secret is required');
    }
    if (nodeEnv === 'production') {
      throw new Error('HmacTokenVerifier must not be selected when NODE_ENV is production');
    }
  }

  async verifyIdToken(token: string): Promise<VerifiedIdentity> {
    const parts = token.split('.');
    const version = parts[0];
    const payloadSegment = parts[1];
    const signature = parts[2];
    if (parts.length !== 3 || version !== 'v1' || !payloadSegment || !signature) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
    }

    const expected = signPayload(this.secret, payloadSegment);
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    } catch {
      throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
    }

    return identityFromPayload(parsed as Record<string, unknown>);
  }
}
