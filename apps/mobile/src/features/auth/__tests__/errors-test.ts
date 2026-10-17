import {
  AuthError,
  AUTH_FALLBACK_MESSAGE,
  authErrorMessage,
  isCancelledCode,
  toAuthError,
} from '@/features/auth/errors';

describe('authErrorMessage', () => {
  const WRONG_PASSWORD =
    'That password doesn’t match this email. Try again or reset it.';

  test.each([
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
    'invalid-credential',
  ])('%s reads as a wrong password', (code) => {
    expect(authErrorMessage(code)).toBe(WRONG_PASSWORD);
  });

  test.each([
    ['auth/email-already-in-use', /already exists/],
    ['auth/weak-password', /at least 8 characters/],
    ['auth/invalid-email', /valid email/],
    ['auth/too-many-requests', /Too many attempts/],
    ['auth/network-request-failed', /No connection/],
    ['auth/user-disabled', /disabled/],
  ])('%s has its own copy', (code, pattern) => {
    expect(authErrorMessage(code)).toMatch(pattern);
  });

  test('unknown or missing codes fall back to generic copy', () => {
    expect(authErrorMessage('auth/something-new')).toBe(AUTH_FALLBACK_MESSAGE);
    expect(authErrorMessage(undefined)).toBe(AUTH_FALLBACK_MESSAGE);
    expect(authErrorMessage(null)).toBe(AUTH_FALLBACK_MESSAGE);
  });
});

describe('toAuthError', () => {
  test('passes an AuthError through unchanged', () => {
    const original = new AuthError({ kind: 'cancelled' });
    expect(toAuthError(original)).toBe(original);
  });

  test('maps a Firebase error to its message', () => {
    const error = toAuthError({ code: 'auth/invalid-credential' });
    expect(error).toBeInstanceOf(AuthError);
    expect(error.failure).toEqual({
      kind: 'error',
      message: authErrorMessage('auth/invalid-credential'),
    });
    expect(error.message).toBe(authErrorMessage('auth/invalid-credential'));
  });

  test('treats a closed popup as a silent cancel', () => {
    expect(isCancelledCode('auth/popup-closed-by-user')).toBe(true);
    expect(toAuthError({ code: 'auth/popup-closed-by-user' }).failure).toEqual({
      kind: 'cancelled',
    });
  });

  test('non-Firebase errors get the generic message', () => {
    expect(toAuthError(new Error('boom')).failure).toEqual({
      kind: 'error',
      message: AUTH_FALLBACK_MESSAGE,
    });
  });
});
