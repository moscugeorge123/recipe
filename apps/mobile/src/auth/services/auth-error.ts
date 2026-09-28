import {
  AuthErrorCode,
  authErrorMessage,
  mapFirebaseAuthError,
  type AuthErrorCode as AuthErrorCodeValue,
} from '@recipe/contracts';

import { ApiError } from '@/services/api-client';

const LOCAL_FIREBASE_CODES: Record<string, AuthErrorCodeValue> = {
  'auth/not-configured': AuthErrorCode.AUTH_NOT_CONFIGURED,
  'auth/operation-not-supported': AuthErrorCode.AUTH_NOT_CONFIGURED,
};

export const PHONE_VERIFIER_MESSAGE =
  'Phone verification needs a configured Firebase app';

export class AuthFlowError extends Error {
  readonly code: AuthErrorCodeValue;

  constructor(code: AuthErrorCodeValue, message?: string) {
    super(message ?? authErrorMessage(code));
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

export function readErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function isAuthErrorCode(code: string): code is AuthErrorCodeValue {
  return Object.prototype.hasOwnProperty.call(AuthErrorCode, code);
}

export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.status === 0) return true;
    if (err.code === AuthErrorCode.AUTH_NETWORK_ERROR) return true;
  }
  if (err instanceof TypeError) return true;
  return readErrorCode(err) === 'auth/network-request-failed';
}

/**
 * Maps Firebase and API failures to a client-safe error.
 * The message never includes a raw `auth/…` code.
 */
export function normalizeAuthFailure(err: unknown): AuthFlowError {
  if (err instanceof AuthFlowError) return err;

  if (err instanceof ApiError && err.code?.startsWith('AUTH_')) {
    if (isAuthErrorCode(err.code)) {
      return new AuthFlowError(err.code, authErrorMessage(err.code));
    }
    return new AuthFlowError(AuthErrorCode.AUTH_UNKNOWN_ERROR);
  }

  const firebaseCode = readErrorCode(err);
  if (firebaseCode === 'auth/operation-not-supported') {
    return new AuthFlowError(
      AuthErrorCode.AUTH_NOT_CONFIGURED,
      PHONE_VERIFIER_MESSAGE,
    );
  }
  if (firebaseCode && LOCAL_FIREBASE_CODES[firebaseCode]) {
    return new AuthFlowError(LOCAL_FIREBASE_CODES[firebaseCode]);
  }
  if (isNetworkFailure(err)) {
    return new AuthFlowError(AuthErrorCode.AUTH_NETWORK_ERROR);
  }

  const mapped = mapFirebaseAuthError(firebaseCode);
  return new AuthFlowError(mapped, authErrorMessage(mapped));
}
