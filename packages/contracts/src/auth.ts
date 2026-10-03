/**
 * Shared authentication contract.
 *
 * Firebase Authentication is the identity provider. This module is the application
 * contract both the API and the mobile client use: username rules, error codes,
 * the auth state machine, and the application user shape. It does not talk to
 * Firebase and it does not store secrets.
 */

export const AuthErrorCode = {
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_ALREADY_EXISTS: "AUTH_EMAIL_ALREADY_EXISTS",
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",
  AUTH_WRONG_PASSWORD: "AUTH_WRONG_PASSWORD",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  AUTH_EMAIL_INVALID: "AUTH_EMAIL_INVALID",
  AUTH_PASSWORD_WEAK: "AUTH_PASSWORD_WEAK",
  AUTH_PHONE_INVALID: "AUTH_PHONE_INVALID",
  AUTH_PHONE_CODE_INVALID: "AUTH_PHONE_CODE_INVALID",
  AUTH_PHONE_CODE_EXPIRED: "AUTH_PHONE_CODE_EXPIRED",
  AUTH_TOO_MANY_REQUESTS: "AUTH_TOO_MANY_REQUESTS",
  AUTH_PROVIDER_ALREADY_LINKED: "AUTH_PROVIDER_ALREADY_LINKED",
  AUTH_CREDENTIAL_ALREADY_IN_USE: "AUTH_CREDENTIAL_ALREADY_IN_USE",
  AUTH_REQUIRES_RECENT_LOGIN: "AUTH_REQUIRES_RECENT_LOGIN",
  AUTH_PROVIDER_CANCELLED: "AUTH_PROVIDER_CANCELLED",
  AUTH_NETWORK_ERROR: "AUTH_NETWORK_ERROR",
  AUTH_UNKNOWN_ERROR: "AUTH_UNKNOWN_ERROR",
  AUTH_USERNAME_TAKEN: "AUTH_USERNAME_TAKEN",
  AUTH_USERNAME_INVALID: "AUTH_USERNAME_INVALID",
  AUTH_LAST_PROVIDER: "AUTH_LAST_PROVIDER",
  AUTH_APP_CHECK_FAILED: "AUTH_APP_CHECK_FAILED",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_NOT_CONFIGURED: "AUTH_NOT_CONFIGURED",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export const AuthPhase = {
  INITIALIZING: "INITIALIZING",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  AUTHENTICATED: "AUTHENTICATED",
  AUTHENTICATED_ONBOARDING_REQUIRED: "AUTHENTICATED_ONBOARDING_REQUIRED",
  AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED:
    "AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED",
  AUTHENTICATED_PHONE_VERIFICATION_REQUIRED:
    "AUTHENTICATED_PHONE_VERIFICATION_REQUIRED",
  AUTHENTICATED_READY: "AUTHENTICATED_READY",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
} as const;

export type AuthPhase = (typeof AuthPhase)[keyof typeof AuthPhase];

export const AppRole = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const RecipeVisibility = {
  PRIVATE: "PRIVATE",
  UNLISTED: "UNLISTED",
  PUBLIC: "PUBLIC",
} as const;

export type RecipeVisibility =
  (typeof RecipeVisibility)[keyof typeof RecipeVisibility];

/** Firebase provider ids. Password is `password`, phone is `phone`. */
export const AuthProviderId = {
  GOOGLE: "google.com",
  FACEBOOK: "facebook.com",
  PASSWORD: "password",
  PHONE: "phone",
  ANONYMOUS: "anonymous",
} as const;

export type AuthProviderId =
  (typeof AuthProviderId)[keyof typeof AuthProviderId];

export const AUTH_ANALYTICS_EVENTS = [
  "auth_screen_viewed",
  "login_started",
  "login_completed",
  "signup_started",
  "signup_completed",
  "google_login",
  "facebook_login",
  "email_login",
  "phone_verification_started",
  "phone_verification_completed",
  "email_verification_completed",
  "provider_linked",
  "password_reset_started",
  "account_deleted",
] as const;

export type AuthAnalyticsEvent = (typeof AUTH_ANALYTICS_EVENTS)[number];

export const AUTH_AUDIT_EVENTS = [
  "USER_REGISTERED",
  "USER_LOGIN",
  "USER_LOGOUT",
  "USER_EMAIL_VERIFIED",
  "USER_PHONE_VERIFIED",
  "PROVIDER_LINKED",
  "PROVIDER_UNLINKED",
  "PASSWORD_CHANGED",
  "EMAIL_CHANGED",
  "PHONE_CHANGED",
  "ACCOUNT_DELETED",
  "FAILED_LOGIN",
  "PASSWORD_RESET_REQUESTED",
] as const;

export type AuthAuditEvent = (typeof AUTH_AUDIT_EVENTS)[number];

export interface ApplicationUser {
  id: string;
  /** Firebase UID. Canonical identity. Never an email or a client-supplied id. */
  uid: string;
  username: string | null;
  usernameNormalized: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  providers: string[];
  onboardingCompleted: boolean;
  role: AppRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthBootstrapResponse {
  user: ApplicationUser;
  created: boolean;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Reserved names are blocked in every environment. Deployments may append more
 * through `extraReserved`, but they cannot remove these.
 */
export const DEFAULT_RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "support",
  "moderator",
  "system",
  "root",
  "api",
  "official",
  "help",
  "security",
  "staff",
  "tortie",
  "firebase",
  "null",
  "undefined",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

const WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "qwertyui",
  "qwerty123",
  "letmein1",
  "tortie123",
  "iloveyou",
  "admin123",
  "welcome1",
]);

export interface UsernameValidationOptions {
  extraReserved?: readonly string[];
}

export type FieldValidation =
  | { ok: true }
  | { ok: false; code: AuthErrorCode; message: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): FieldValidation {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_RE.test(normalized)) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_EMAIL_INVALID,
      message: "Enter a valid email address.",
    };
  }
  return { ok: true };
}

export function validatePassword(password: string): FieldValidation {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_PASSWORD_WEAK,
      message: "Passwords need at least 8 characters.",
    };
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_PASSWORD_WEAK,
      message: "Choose a less common password.",
    };
  }
  return { ok: true };
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(
  username: string,
  options: UsernameValidationOptions = {},
): FieldValidation & { username?: string; usernameNormalized?: string } {
  if (/\s/.test(username)) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_USERNAME_INVALID,
      message: "Usernames can’t contain spaces.",
    };
  }
  const display = username.trim();
  const usernameNormalized = normalizeUsername(display);
  if (
    usernameNormalized.length < USERNAME_MIN_LENGTH ||
    usernameNormalized.length > USERNAME_MAX_LENGTH ||
    !USERNAME_RE.test(usernameNormalized)
  ) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_USERNAME_INVALID,
      message: "Use 3–30 letters, numbers, periods, or underscores.",
    };
  }
  if (usernameNormalized.includes("..")) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_USERNAME_INVALID,
      message: "Usernames can’t contain repeated periods.",
    };
  }
  const reserved = new Set<string>([
    ...DEFAULT_RESERVED_USERNAMES,
    ...(options.extraReserved ?? []).map((name) => normalizeUsername(name)),
  ]);
  if (reserved.has(usernameNormalized)) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_USERNAME_INVALID,
      message: "That username is reserved.",
    };
  }
  return { ok: true, username: display, usernameNormalized };
}

export function normalizePhoneE164(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  return compact;
}

export function validatePhoneE164(input: string): FieldValidation & {
  e164?: string;
} {
  const e164 = normalizePhoneE164(input);
  if (!E164_RE.test(e164)) {
    return {
      ok: false,
      code: AuthErrorCode.AUTH_PHONE_INVALID,
      message: "Enter a phone number with the country code, like +40…",
    };
  }
  return { ok: true, e164 };
}

/** Recent sign-in window for sensitive account operations (Firebase `auth_time`). */
export const RECENT_AUTH_WINDOW_SECONDS = 5 * 60;

export function isRecentAuth(authTimeSeconds: number, nowMs = Date.now()): boolean {
  if (!Number.isFinite(authTimeSeconds) || authTimeSeconds <= 0) return false;
  const ageMs = nowMs - authTimeSeconds * 1000;
  return ageMs >= -30_000 && ageMs <= RECENT_AUTH_WINDOW_SECONDS * 1000;
}

export interface AuthPhaseInput {
  initialized: boolean;
  failed?: boolean;
  hasFirebaseUser: boolean;
  appUserLoaded: boolean;
  username: string | null;
  onboardingCompleted: boolean;
  /** Password provider is linked and Firebase says the email is unverified. */
  emailVerificationBlocking: boolean;
  /** A product flow explicitly requires a verified phone before continuing. */
  phoneVerificationBlocking: boolean;
}

/**
 * Single auth state machine. Screens should read this instead of inventing
 * their own checks.
 *
 * Priority: init → error → signed out → profile still loading → username /
 * onboarding → email verification → phone verification → ready.
 */
export function deriveAuthPhase(input: AuthPhaseInput): AuthPhase {
  if (!input.initialized) return AuthPhase.INITIALIZING;
  if (input.failed) return AuthPhase.AUTHENTICATION_ERROR;
  if (!input.hasFirebaseUser) return AuthPhase.UNAUTHENTICATED;
  if (!input.appUserLoaded) return AuthPhase.AUTHENTICATED;
  if (!input.username || !input.onboardingCompleted) {
    return AuthPhase.AUTHENTICATED_ONBOARDING_REQUIRED;
  }
  if (input.emailVerificationBlocking) {
    return AuthPhase.AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED;
  }
  if (input.phoneVerificationBlocking) {
    return AuthPhase.AUTHENTICATED_PHONE_VERIFICATION_REQUIRED;
  }
  return AuthPhase.AUTHENTICATED_READY;
}

const FIREBASE_ERROR_MAP: Record<string, AuthErrorCode> = {
  "auth/invalid-credential": AuthErrorCode.AUTH_INVALID_CREDENTIALS,
  "auth/invalid-login-credentials": AuthErrorCode.AUTH_INVALID_CREDENTIALS,
  "auth/wrong-password": AuthErrorCode.AUTH_WRONG_PASSWORD,
  "auth/user-not-found": AuthErrorCode.AUTH_USER_NOT_FOUND,
  "auth/email-already-in-use": AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
  "auth/credential-already-in-use": AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE,
  "auth/account-exists-with-different-credential":
    AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE,
  "auth/provider-already-linked": AuthErrorCode.AUTH_PROVIDER_ALREADY_LINKED,
  "auth/requires-recent-login": AuthErrorCode.AUTH_REQUIRES_RECENT_LOGIN,
  "auth/invalid-verification-code": AuthErrorCode.AUTH_PHONE_CODE_INVALID,
  "auth/invalid-verification-id": AuthErrorCode.AUTH_PHONE_CODE_EXPIRED,
  "auth/code-expired": AuthErrorCode.AUTH_PHONE_CODE_EXPIRED,
  "auth/session-expired": AuthErrorCode.AUTH_PHONE_CODE_EXPIRED,
  "auth/missing-verification-code": AuthErrorCode.AUTH_PHONE_CODE_INVALID,
  "auth/invalid-phone-number": AuthErrorCode.AUTH_PHONE_INVALID,
  "auth/too-many-requests": AuthErrorCode.AUTH_TOO_MANY_REQUESTS,
  "auth/quota-exceeded": AuthErrorCode.AUTH_TOO_MANY_REQUESTS,
  "auth/network-request-failed": AuthErrorCode.AUTH_NETWORK_ERROR,
  "auth/popup-closed-by-user": AuthErrorCode.AUTH_PROVIDER_CANCELLED,
  "auth/cancelled-popup-request": AuthErrorCode.AUTH_PROVIDER_CANCELLED,
  "auth/user-cancelled": AuthErrorCode.AUTH_PROVIDER_CANCELLED,
  "auth/user-disabled": AuthErrorCode.AUTH_INVALID_CREDENTIALS,
  "auth/weak-password": AuthErrorCode.AUTH_PASSWORD_WEAK,
  "auth/invalid-email": AuthErrorCode.AUTH_EMAIL_INVALID,
  "auth/id-token-expired": AuthErrorCode.AUTH_TOKEN_EXPIRED,
  "auth/id-token-revoked": AuthErrorCode.AUTH_TOKEN_INVALID,
  "auth/argument-error": AuthErrorCode.AUTH_TOKEN_INVALID,
  "auth/invalid-id-token": AuthErrorCode.AUTH_TOKEN_INVALID,
  "auth/app-check-token-invalid": AuthErrorCode.AUTH_APP_CHECK_FAILED,
};

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: "That email and password don’t match.",
  AUTH_EMAIL_ALREADY_EXISTS: "An account already exists with this email.",
  AUTH_USER_NOT_FOUND: "We couldn’t find an account with that email.",
  AUTH_WRONG_PASSWORD: "That password doesn’t match this email.",
  AUTH_EMAIL_NOT_VERIFIED: "Verify your email before continuing.",
  AUTH_EMAIL_INVALID: "Enter a valid email address.",
  AUTH_PASSWORD_WEAK: "Choose a stronger password.",
  AUTH_PHONE_INVALID: "Enter a valid phone number with the country code.",
  AUTH_PHONE_CODE_INVALID: "That code doesn’t match. Try again.",
  AUTH_PHONE_CODE_EXPIRED: "That code has expired. Request a new one.",
  AUTH_TOO_MANY_REQUESTS: "Too many attempts. Wait a moment and try again.",
  AUTH_PROVIDER_ALREADY_LINKED: "That sign-in method is already connected.",
  AUTH_CREDENTIAL_ALREADY_IN_USE:
    "An account already exists with this email. Sign in and connect it.",
  AUTH_REQUIRES_RECENT_LOGIN: "Please sign in again to continue.",
  AUTH_PROVIDER_CANCELLED: "Sign-in was cancelled.",
  AUTH_NETWORK_ERROR: "We couldn’t reach the network. Try again.",
  AUTH_UNKNOWN_ERROR: "Something went wrong. Try again.",
  AUTH_USERNAME_TAKEN: "That username is taken.",
  AUTH_USERNAME_INVALID: "That username can’t be used.",
  AUTH_LAST_PROVIDER: "Add another sign-in method before removing this one.",
  AUTH_APP_CHECK_FAILED: "This app couldn’t be verified. Try again.",
  AUTH_TOKEN_EXPIRED: "Your session expired. Sign in again.",
  AUTH_TOKEN_INVALID: "Your session is no longer valid. Sign in again.",
  AUTH_NOT_CONFIGURED: "Sign-in isn’t available in this build yet.",
};

export function authErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code];
}

export function mapFirebaseAuthError(code: string | undefined): AuthErrorCode {
  if (!code) return AuthErrorCode.AUTH_UNKNOWN_ERROR;
  return FIREBASE_ERROR_MAP[code] ?? AuthErrorCode.AUTH_UNKNOWN_ERROR;
}

export interface NormalizedAuthError {
  code: AuthErrorCode;
  message: string;
}

/** Maps a Firebase error code to a client-safe application error. Never returns raw Firebase text. */
export function normalizeAuthError(code: string | undefined): NormalizedAuthError {
  const mapped = mapFirebaseAuthError(code);
  return { code: mapped, message: authErrorMessage(mapped) };
}

/**
 * Unlinking is refused when it would leave the user with no usable method.
 * Anonymous does not count as a usable method.
 */
export function canUnlinkProvider(providers: readonly string[], target: string): boolean {
  const usable = providers.filter((provider) => provider !== AuthProviderId.ANONYMOUS);
  if (!usable.includes(target)) return false;
  return usable.length > 1;
}

export type LinkCollisionAction = "link" | "sign-in-then-link" | "already-linked" | "reject";

/**
 * Pure account-linking decision used by the client flow and by tests.
 * The same Firebase UID must be kept; collisions never create a second user.
 */
export function planProviderLink(input: {
  currentProviders: readonly string[];
  incomingProvider: string;
  firebaseError?: string;
}): { action: LinkCollisionAction; code?: AuthErrorCode } {
  if (input.currentProviders.includes(input.incomingProvider)) {
    return {
      action: "already-linked",
      code: AuthErrorCode.AUTH_PROVIDER_ALREADY_LINKED,
    };
  }
  const mapped = input.firebaseError ? mapFirebaseAuthError(input.firebaseError) : undefined;
  if (
    mapped === AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE ||
    mapped === AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS
  ) {
    return { action: "sign-in-then-link", code: mapped };
  }
  if (mapped && mapped !== AuthErrorCode.AUTH_UNKNOWN_ERROR && input.firebaseError) {
    return { action: "reject", code: mapped };
  }
  return { action: "link" };
}
