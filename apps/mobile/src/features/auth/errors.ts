import { tNow } from '@/i18n/format';
import { MESSAGES, type MessageKey } from '@/i18n/messages';

const MESSAGES_EN = MESSAGES.en;

/** Why an auth call failed, in the shape the sign-in UI renders. */
export type AuthFailure =
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }
  | {
      kind: 'collision';
      email: string;
      existingProvider: 'google' | 'facebook' | 'password';
    };

/** Every `authService` method throws this; `failure` says what to show. */
export class AuthError extends Error {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure) {
    super(
      failure.kind === 'error'
        ? failure.message
        : failure.kind === 'cancelled'
          ? 'Sign-in cancelled'
          : 'This email already has an account with another sign-in method.',
    );
    this.name = 'AuthError';
    this.failure = failure;
  }
}

/** English fallback, for tests; the app shows `tNow('auth.errFallback')`. */
export const AUTH_FALLBACK_MESSAGE = MESSAGES_EN['auth.errFallback'];

const CODE_KEYS: Record<string, MessageKey> = {
  'invalid-credential': 'auth.errPassword',
  'wrong-password': 'auth.errPassword',
  'user-not-found': 'auth.errPassword',
  'email-already-in-use': 'auth.errEmailInUse',
  'weak-password': 'auth.errShort',
  'invalid-email': 'auth.errEmail',
  'missing-email': 'auth.errEmail',
  'too-many-requests': 'auth.errTooMany',
  'network-request-failed': 'auth.errNetwork',
  'user-disabled': 'auth.errDisabled',
  'requires-recent-login': 'auth.errRecentLogin',
  'credential-already-in-use': 'auth.errCredentialInUse',
  'provider-already-linked': 'auth.errAlreadyLinked',
  'operation-not-allowed': 'auth.errNotAllowed',
};

/** Normalises `auth/invalid-credential` and `invalid-credential` alike. */
function bareCode(code: string): string {
  return code.startsWith('auth/') ? code.slice('auth/'.length) : code;
}

/** User-facing copy for a Firebase Auth error code. */
export function authErrorMessage(code: string | undefined | null): string {
  return tNow((code && CODE_KEYS[bareCode(code)]) || 'auth.errFallback');
}

/** Error codes that mean the user backed out; the UI returns to start silently. */
const CANCEL_CODES = new Set([
  'popup-closed-by-user',
  'cancelled-popup-request',
  'user-cancelled',
]);

export function isCancelledCode(code: string | undefined | null): boolean {
  return !!code && CANCEL_CODES.has(bareCode(code));
}

/** The `code` string on a Firebase or native-module error, if it has one. */
export function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** Maps anything thrown by Firebase or a provider SDK onto an `AuthError`. */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }
  const code = errorCode(error);
  if (isCancelledCode(code)) {
    return new AuthError({ kind: 'cancelled' });
  }
  return new AuthError({ kind: 'error', message: authErrorMessage(code) });
}
