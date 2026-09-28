import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  unlink,
  updatePassword,
  type ApplicationVerifier,
  type Auth,
  type AuthCredential,
  type Persistence,
  type User,
} from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';

import {
  getFirebaseApp,
  isFirebaseConfigured,
  readFirebaseConfig,
} from '@/auth/firebase/firebase.config';
import { validatePhoneE164 } from '@recipe/contracts';
import type {
  AuthGateway,
  FirebaseUserSnapshot,
  OAuthPromptHooks,
  ReauthenticateInput,
} from '@/auth/types';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const COLLISION_CODES = new Set([
  'auth/credential-already-in-use',
  'auth/account-exists-with-different-credential',
  'auth/email-already-in-use',
]);

/**
 * Held only in memory so a "credential already in use" sign-in can link the
 * provider onto the existing Firebase user. Never written to disk.
 */
let pendingCredential: AuthCredential | null = null;

export class CodedAuthError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'CodedAuthError';
    this.code = code;
  }
}

function readCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function isCollision(code: string | undefined): boolean {
  return !!code && COLLISION_CODES.has(code);
}

function providerIdsOf(user: User): string[] {
  const ids = user.providerData.map((entry) => entry.providerId);
  if (user.isAnonymous && !ids.includes('anonymous')) ids.push('anonymous');
  return ids;
}

function toSnapshot(user: User): FirebaseUserSnapshot {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
    providerIds: providerIdsOf(user),
    getIdToken: (force?: boolean) => user.getIdToken(Boolean(force)),
  };
}

function reactNativePersistence(): Persistence | undefined {
  const authModule = firebaseAuth as typeof firebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  if (typeof authModule.getReactNativePersistence !== 'function') {
    return undefined;
  }
  return authModule.getReactNativePersistence(AsyncStorage);
}

function ensureAuth(app: NonNullable<ReturnType<typeof getFirebaseApp>>): Auth {
  const persistence = reactNativePersistence();
  try {
    if (persistence) return initializeAuth(app, { persistence });
  } catch {
    return getAuth(app);
  }
  try {
    return getAuth(app);
  } catch {
    return initializeAuth(app);
  }
}

export class FirebaseAuthGateway implements AuthGateway {
  private auth: Auth | null = null;
  private recaptcha: RecaptchaVerifier | null = null;
  private ready: Promise<void> | null = null;

  initialize(): Promise<void> {
    if (!this.ready) {
      this.ready = Promise.resolve().then(() => {
        if (!isFirebaseConfigured()) return;
        const app = getFirebaseApp();
        if (!app) return;
        try {
          this.auth = ensureAuth(app);
        } catch {
          this.auth = null;
        }
      });
    }
    return this.ready;
  }

  private requireAuth(): Auth {
    if (!this.auth || !isFirebaseConfigured()) {
      throw new CodedAuthError('auth/not-configured');
    }
    return this.auth;
  }

  private requireUser(): User {
    const user = this.requireAuth().currentUser;
    if (!user) throw new CodedAuthError('auth/user-not-found');
    return user;
  }

  onAuthStateChanged(
    listener: (user: FirebaseUserSnapshot | null) => void,
  ): () => void {
    if (!this.auth) {
      listener(null);
      return () => undefined;
    }
    return onAuthStateChanged(this.auth, (user) => {
      listener(user ? toSnapshot(user) : null);
    });
  }

  currentUser(): FirebaseUserSnapshot | null {
    const user = this.auth?.currentUser;
    return user ? toSnapshot(user) : null;
  }

  async getIdToken(force = false): Promise<string | null> {
    const user = this.auth?.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken(force);
    } catch {
      return null;
    }
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<FirebaseUserSnapshot> {
    const auth = this.requireAuth();
    const result = await signInWithEmailAndPassword(auth, email, password);
    return toSnapshot(result.user);
  }

  async registerWithEmail(
    email: string,
    password: string,
  ): Promise<FirebaseUserSnapshot> {
    const auth = this.requireAuth();
    const result = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(result.user);
    } catch {
      // The account exists. Profile can resend verification.
    }
    return toSnapshot(result.user);
  }

  async signInWithGoogle(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot> {
    const idToken = await this.promptGoogle(hooks);
    return this.signInWithAuthCredential(GoogleAuthProvider.credential(idToken));
  }

  async signInWithFacebook(
    hooks?: OAuthPromptHooks,
  ): Promise<FirebaseUserSnapshot> {
    const accessToken = await this.promptFacebook(hooks);
    return this.signInWithAuthCredential(
      FacebookAuthProvider.credential(accessToken),
    );
  }

  async signInAnonymously(): Promise<FirebaseUserSnapshot> {
    const auth = this.requireAuth();
    const result = await signInAnonymously(auth);
    return toSnapshot(result.user);
  }

  async signOut(): Promise<void> {
    const auth = this.auth;
    if (!auth) return;
    await firebaseSignOut(auth);
  }

  async sendEmailVerification(): Promise<void> {
    await sendEmailVerification(this.requireUser());
  }

  async reload(): Promise<FirebaseUserSnapshot> {
    const user = this.requireUser();
    await user.reload();
    const next = this.requireAuth().currentUser;
    if (!next) throw new CodedAuthError('auth/user-not-found');
    return toSnapshot(next);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.requireAuth(), email);
  }

  async linkGoogle(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot> {
    const idToken = await this.promptGoogle(hooks);
    return this.linkOrRemember(GoogleAuthProvider.credential(idToken));
  }

  async linkFacebook(hooks?: OAuthPromptHooks): Promise<FirebaseUserSnapshot> {
    const accessToken = await this.promptFacebook(hooks);
    return this.linkOrRemember(FacebookAuthProvider.credential(accessToken));
  }

  async linkEmailPassword(
    email: string,
    password: string,
  ): Promise<FirebaseUserSnapshot> {
    return this.linkOrRemember(EmailAuthProvider.credential(email, password));
  }

  async linkPhone(
    verificationId: string,
    code: string,
  ): Promise<FirebaseUserSnapshot> {
    return this.linkOrRemember(PhoneAuthProvider.credential(verificationId, code));
  }

  async startPhoneVerification(
    phoneE164: string,
  ): Promise<{ verificationId: string }> {
    const checked = validatePhoneE164(phoneE164);
    if (!checked.ok || !checked.e164) {
      throw new CodedAuthError('auth/invalid-phone-number');
    }
    const auth = this.requireAuth();
    const verifier = this.applicationVerifier();
    const provider = new PhoneAuthProvider(auth);
    const verificationId = await provider.verifyPhoneNumber(
      checked.e164,
      verifier,
    );
    return { verificationId };
  }

  /**
   * Confirms a code the UI is holding. The code is not stored on this module.
   * A signed-in user links the phone; otherwise this signs in.
   */
  async confirmPhoneCode(
    verificationId: string,
    code: string,
  ): Promise<FirebaseUserSnapshot> {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    if (this.auth?.currentUser) return this.linkOrRemember(credential);
    return this.signInWithAuthCredential(credential);
  }

  async unlinkProvider(providerId: string): Promise<FirebaseUserSnapshot> {
    const user = this.requireUser();
    const result = await unlink(user, providerId);
    return toSnapshot(result);
  }

  async reauthenticate(input: ReauthenticateInput): Promise<void> {
    const user = this.requireUser();
    const credential = await this.credentialFor(input);
    await reauthenticateWithCredential(user, credential);
  }

  async updateEmail(email: string): Promise<void> {
    const user = this.requireUser();
    const verify = firebaseAuth.verifyBeforeUpdateEmail;
    if (typeof verify === 'function') {
      await verify(user, email);
      return;
    }
    if (typeof firebaseAuth.updateEmail === 'function') {
      await firebaseAuth.updateEmail(user, email);
      await sendEmailVerification(user);
      return;
    }
    throw new CodedAuthError('auth/operation-not-supported');
  }

  async updatePassword(password: string): Promise<void> {
    await updatePassword(this.requireUser(), password);
  }

  async deleteCurrentUser(): Promise<void> {
    await this.requireUser().delete();
  }

  async consumePendingLink(): Promise<FirebaseUserSnapshot | null> {
    const credential = pendingCredential;
    const user = this.auth?.currentUser;
    if (!credential || !user) return null;
    pendingCredential = null;
    try {
      const result = await linkWithCredential(user, credential);
      return toSnapshot(result.user);
    } catch (err) {
      const code = readCode(err);
      if (code === 'auth/provider-already-linked' || isCollision(code)) {
        return toSnapshot(user);
      }
      pendingCredential = credential;
      return null;
    }
  }

  private async signInWithAuthCredential(
    credential: AuthCredential,
  ): Promise<FirebaseUserSnapshot> {
    const auth = this.requireAuth();
    try {
      const result = await signInWithCredential(auth, credential);
      return toSnapshot(result.user);
    } catch (err) {
      if (isCollision(readCode(err))) pendingCredential = credential;
      throw err;
    }
  }

  private async linkOrRemember(
    credential: AuthCredential,
  ): Promise<FirebaseUserSnapshot> {
    const user = this.requireUser();
    try {
      const result = await linkWithCredential(user, credential);
      return toSnapshot(result.user);
    } catch (err) {
      if (isCollision(readCode(err))) pendingCredential = credential;
      throw err;
    }
  }

  private async credentialFor(
    input: ReauthenticateInput,
  ): Promise<AuthCredential> {
    if (input.kind === 'password') {
      return EmailAuthProvider.credential(input.email, input.password);
    }
    if (input.kind === 'google') {
      return GoogleAuthProvider.credential(await this.promptGoogle());
    }
    if (input.kind === 'facebook') {
      return FacebookAuthProvider.credential(await this.promptFacebook());
    }
    return PhoneAuthProvider.credential(input.verificationId, input.code);
  }

  private applicationVerifier(): ApplicationVerifier {
    if (Platform.OS !== 'web') {
      throw new CodedAuthError('auth/operation-not-supported');
    }
    const auth = this.requireAuth();
    try {
      if (!this.recaptcha) {
        const containerId = ensureRecaptchaContainer();
        this.recaptcha = new RecaptchaVerifier(auth, containerId, {
          size: 'invisible',
        });
      }
      return this.recaptcha;
    } catch (err) {
      if (err instanceof CodedAuthError) throw err;
      throw new CodedAuthError('auth/operation-not-supported');
    }
  }

  private async promptGoogle(hooks?: OAuthPromptHooks): Promise<string> {
    const config = readFirebaseConfig();
    const clientId =
      Platform.OS === 'ios'
        ? config.googleIosClientId || config.googleWebClientId
        : config.googleWebClientId;
    if (!clientId) throw new CodedAuthError('auth/not-configured');
    if (!isFirebaseConfigured()) throw new CodedAuthError('auth/not-configured');

    WebBrowser.maybeCompleteAuthSession();
    const nonce = Crypto.randomUUID().replace(/-/g, '');
    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri: AuthSession.makeRedirectUri(),
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      extraParams: { nonce },
    });
    const result = await request.promptAsync(GOOGLE_DISCOVERY);
    hooks?.onPromptReturned?.();
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new CodedAuthError('auth/popup-closed-by-user');
    }
    if (result.type !== 'success') {
      throw new CodedAuthError('auth/popup-closed-by-user');
    }
    const idToken = result.params.id_token || result.authentication?.idToken;
    if (!idToken) throw new CodedAuthError('auth/invalid-credential');
    return idToken;
  }

  private async promptFacebook(hooks?: OAuthPromptHooks): Promise<string> {
    const appId = readFirebaseConfig().facebookAppId;
    if (!appId || !isFirebaseConfigured()) {
      throw new CodedAuthError('auth/not-configured');
    }
    WebBrowser.maybeCompleteAuthSession();
    const request = new AuthSession.AuthRequest({
      clientId: appId,
      redirectUri: AuthSession.makeRedirectUri(),
      scopes: ['public_profile', 'email'],
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    });
    const result = await request.promptAsync({
      authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
    });
    hooks?.onPromptReturned?.();
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new CodedAuthError('auth/popup-closed-by-user');
    }
    if (result.type === 'error') {
      const reason = result.params.error || result.errorCode || '';
      if (reason === 'access_denied' || reason === 'user_denied') {
        throw new CodedAuthError('auth/user-cancelled');
      }
      throw new CodedAuthError('auth/user-cancelled');
    }
    if (result.type !== 'success') {
      throw new CodedAuthError('auth/popup-closed-by-user');
    }
    const accessToken =
      result.params.access_token || result.authentication?.accessToken;
    if (!accessToken) throw new CodedAuthError('auth/user-cancelled');
    return accessToken;
  }
}

function ensureRecaptchaContainer(): string {
  if (typeof document === 'undefined') {
    throw new CodedAuthError('auth/operation-not-supported');
  }
  const id = 'tortie-recaptcha';
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('div');
    element.id = id;
    document.body.appendChild(element);
  }
  return id;
}
