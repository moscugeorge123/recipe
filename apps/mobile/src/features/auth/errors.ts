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

export const AUTH_FALLBACK_MESSAGE = 'Something went wrong. Try again.';

const WRONG_PASSWORD =
  'That password doesn’t match this email. Try again or reset it.';

const MESSAGES: Record<string, string> = {
  'invalid-credential': WRONG_PASSWORD,
  'wrong-password': WRONG_PASSWORD,
  'user-not-found': WRONG_PASSWORD,
  'email-already-in-use':
    'An account with this email already exists. Log in instead, or reset your password.',
  'weak-password': 'Passwords need at least 8 characters.',
  'invalid-email': 'Enter a valid email address, like you@example.com.',
  'missing-email': 'Enter a valid email address, like you@example.com.',
  'too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'network-request-failed': 'No connection. Check your network and try again.',
  'user-disabled': 'This account has been disabled. Contact support for help.',
  'requires-recent-login':
    'For your security, sign in again, then try once more.',
  'credential-already-in-use':
    'That account is already connected to another Tortie profile.',
  'provider-already-linked': 'That account is already connected.',
  'operation-not-allowed': 'This sign-in method is not available right now.',
};

/** Normalises `auth/invalid-credential` and `invalid-credential` alike. */
function bareCode(code: string): string {
  return code.startsWith('auth/') ? code.slice('auth/'.length) : code;
}

/** User-facing copy for a Firebase Auth error code. */
export function authErrorMessage(code: string | undefined | null): string {
  if (!code) {
    return AUTH_FALLBACK_MESSAGE;
  }
  return MESSAGES[bareCode(code)] ?? AUTH_FALLBACK_MESSAGE;
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
