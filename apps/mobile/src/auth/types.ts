import type {
  AppRole,
  ApplicationUser,
  AuthAnalyticsEvent,
  AuthBootstrapResponse,
  AuthErrorCode,
  AuthPhase,
  AuthProviderId,
  NormalizedAuthError,
} from '@recipe/contracts';

export type {
  AppRole,
  ApplicationUser,
  AuthAnalyticsEvent,
  AuthBootstrapResponse,
  AuthErrorCode,
  AuthPhase,
  AuthProviderId,
  NormalizedAuthError,
};

/**
 * Firebase user fields the rest of the app is allowed to see.
 * The ID token is fetched on demand and is not stored in zustand.
 */
export type FirebaseUserSnapshot = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  providerIds: string[];
  getIdToken(force?: boolean): Promise<string>;
};

export type OAuthPromptHooks = {
  /** Fired when the native / browser prompt has returned. */
  onPromptReturned?: () => void;
};

export type ReauthenticateInput =
  | { kind: 'password'; email: string; password: string }
  | { kind: 'google' }
  | { kind: 'facebook' }
  | { kind: 'phone'; verificationId: string; code: string };

/**
 * Identity boundary. Firebase SDK calls stay behind this interface.
 * Pending OAuth credentials live in memory on the gateway only.
 */
export interface AuthGateway {
  initialize(): Promise<void>;
  onAuthStateChanged(
    listener: (user: FirebaseUserSnapshot | null) => void,
  ): () => void;
  currentUser(): FirebaseUserSnapshot | null;
  getIdToken(force?: boolean): Promise<string | null>;
  signInWithEmail(email: string, password: string): Promise<FirebaseUserSnapshot>;
  registerWithEmail(email: string, password: string): Promise<FirebaseUserSnapshot>;
  signInWithGoogle(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot>;
  signInWithFacebook(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot>;
  signInAnonymously(): Promise<FirebaseUserSnapshot>;
  signOut(): Promise<void>;
  sendEmailVerification(): Promise<void>;
  reload(): Promise<FirebaseUserSnapshot>;
  sendPasswordReset(email: string): Promise<void>;
  linkGoogle(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot>;
  linkFacebook(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot>;
  linkEmailPassword(email: string, password: string): Promise<FirebaseUserSnapshot>;
  linkPhone(verificationId: string, code: string): Promise<FirebaseUserSnapshot>;
  startPhoneVerification(phoneE164: string): Promise<{ verificationId: string }>;
  confirmPhoneCode(
    verificationId: string,
    code: string,
  ): Promise<FirebaseUserSnapshot>;
  unlinkProvider(providerId: string): Promise<FirebaseUserSnapshot>;
  reauthenticate(input: ReauthenticateInput): Promise<void>;
  updateEmail(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  deleteCurrentUser(): Promise<void>;
  /**
   * After a credential-already-in-use sign-in, link the in-memory pending
   * credential onto the now-current Firebase user. Returns null when there
   * is nothing pending. Never reads a persisted OAuth secret.
   */
  consumePendingLink(): Promise<FirebaseUserSnapshot | null>;
}
