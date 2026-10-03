import {
  AuthErrorCode,
  AuthPhase,
  AuthProviderId,
  canUnlinkProvider,
  deriveAuthPhase,
  normalizeEmail,
  planProviderLink,
  validateEmail,
  validatePassword,
  validatePhoneE164,
  validateUsername,
  type ApplicationUser,
} from '@recipe/contracts';

import { clearAuthAnalyticsBuffer, trackAuth } from '@/auth/analytics';
import {
  AuthFlowError,
  isNetworkFailure,
  normalizeAuthFailure,
  readErrorCode,
} from '@/auth/services/auth-error';
import type { AuthApi, AuthEventBody, BootstrapBody } from '@/auth/services/auth-api';
import {
  buildAuthSlice,
  signedOutSlice,
  type TortieUser,
} from '@/auth/state/auth.store';
import type {
  AuthGateway,
  FirebaseUserSnapshot,
  OAuthPromptHooks,
  ReauthenticateInput,
} from '@/auth/types';
import { ApiError } from '@/services/api-client';
import { useTortieAuth } from '@/tortie/auth-store';

export type AuthResult = {
  user: ApplicationUser;
  created: boolean;
};

export type AuthStatus = 'idle' | 'busy';

function providerLabel(providerId: string): string {
  if (providerId === AuthProviderId.GOOGLE) return 'google';
  if (providerId === AuthProviderId.FACEBOOK) return 'facebook';
  if (providerId === AuthProviderId.PHONE) return 'phone';
  if (providerId === AuthProviderId.PASSWORD) return 'password';
  return 'email';
}

export class AuthService {
  private status: AuthStatus = 'idle';
  private flights = new Map<string, Promise<unknown>>();
  private interactive = 0;
  private initOnce: Promise<void> | null = null;
  private sawUnverifiedEmail = false;

  constructor(
    private readonly gateway: AuthGateway,
    private readonly api: AuthApi,
  ) {}

  getStatus(): AuthStatus {
    return this.status;
  }

  initialize(): Promise<void> {
    if (!this.initOnce) {
      this.initOnce = this.gateway.initialize().catch((err) => {
        this.initOnce = null;
        throw err;
      });
    }
    return this.initOnce;
  }

  /**
   * Cold-start listener. Interactive sign-in methods bootstrap themselves
   * and suppress this path so a username is not raced away.
   */
  subscribe(
    listener?: (user: FirebaseUserSnapshot | null) => void,
  ): () => void {
    return this.gateway.onAuthStateChanged((user) => {
      listener?.(user);
      if (this.interactive > 0) return;
      void this.syncFromAuthState(user);
    });
  }

  getCurrentUser(): TortieUser | null {
    return useTortieAuth.getState().user;
  }

  getIdToken(force?: boolean): Promise<string | null> {
    return this.gateway.getIdToken(force);
  }

  isAuthenticated(): boolean {
    const state = useTortieAuth.getState();
    return state.authed && state.phase !== AuthPhase.UNAUTHENTICATED;
  }

  isEmailVerified(): boolean {
    return Boolean(useTortieAuth.getState().user?.emailVerified);
  }

  isPhoneVerified(): boolean {
    return Boolean(useTortieAuth.getState().user?.phoneVerified);
  }

  getProviders(): string[] {
    return useTortieAuth.getState().user?.providers ?? [];
  }

  noteAuthScreenViewed(): void {
    trackAuth('auth_screen_viewed');
  }

  signInWithGoogle(hooks?: OAuthPromptHooks): Promise<AuthResult> {
    return this.flight('signInWithGoogle', () =>
      this.interactiveCall(() => this.signInProvider('google', hooks)),
    );
  }

  signInWithFacebook(hooks?: OAuthPromptHooks): Promise<AuthResult> {
    return this.flight('signInWithFacebook', () =>
      this.interactiveCall(() => this.signInProvider('facebook', hooks)),
    );
  }

  signInWithEmail(input: {
    email: string;
    password: string;
  }): Promise<AuthResult> {
    return this.flight('signInWithEmail', () =>
      this.interactiveCall(async () => {
        const emailCheck = validateEmail(input.email);
        if (!emailCheck.ok) {
          throw new AuthFlowError(emailCheck.code, emailCheck.message);
        }
        if (!input.password) {
          throw new AuthFlowError(AuthErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        const email = normalizeEmail(input.email);
        trackAuth('login_started', { provider: 'email' });
        await this.initialize();
        let firebaseUser: FirebaseUserSnapshot;
        try {
          firebaseUser = await this.gateway.signInWithEmail(email, input.password);
        } catch (err) {
          const normalized = normalizeAuthFailure(err);
          void this.audit('FAILED_LOGIN', {
            provider: 'email',
            reason: normalized.code,
          });
          throw normalized;
        }
        const result = await this.bootstrap(firebaseUser, {});
        trackAuth('email_login', { provider: 'email' });
        trackAuth(result.created ? 'signup_completed' : 'login_completed', {
          provider: 'email',
        });
        void this.audit(result.created ? 'USER_REGISTERED' : 'USER_LOGIN', {
          provider: 'password',
        });
        return result;
      }),
    );
  }

  registerWithEmail(input: {
    email: string;
    password: string;
    username: string;
    displayName?: string;
  }): Promise<AuthResult> {
    return this.flight('registerWithEmail', () =>
      this.interactiveCall(async () => {
        const emailCheck = validateEmail(input.email);
        if (!emailCheck.ok) {
          throw new AuthFlowError(emailCheck.code, emailCheck.message);
        }
        const passwordCheck = validatePassword(input.password);
        if (!passwordCheck.ok) {
          throw new AuthFlowError(passwordCheck.code, passwordCheck.message);
        }
        const usernameCheck = validateUsername(input.username);
        if (!usernameCheck.ok || !usernameCheck.username) {
          throw new AuthFlowError(
            usernameCheck.ok
              ? AuthErrorCode.AUTH_USERNAME_INVALID
              : usernameCheck.code,
            usernameCheck.ok ? undefined : usernameCheck.message,
          );
        }
        const email = normalizeEmail(input.email);
        trackAuth('signup_started', { provider: 'email' });
        await this.initialize();
        let firebaseUser: FirebaseUserSnapshot;
        try {
          firebaseUser = await this.gateway.registerWithEmail(
            email,
            input.password,
          );
        } catch (err) {
          throw normalizeAuthFailure(err);
        }
        const displayName = input.displayName?.trim();
        const body: BootstrapBody = {
          username: usernameCheck.username,
          ...(displayName ? { displayName } : {}),
        };
        const result = await this.bootstrap(firebaseUser, body);
        trackAuth('signup_completed', { provider: 'email' });
        void this.audit('USER_REGISTERED', { provider: 'password' });
        return result;
      }),
    );
  }

  async signOut(): Promise<void> {
    return this.flight('signOut', () =>
      this.interactiveCall(async () => {
        await this.audit('USER_LOGOUT');
        try {
          await this.gateway.signOut();
        } catch (err) {
          const code = readErrorCode(err);
          if (code !== 'auth/user-not-found' && code !== 'auth/not-configured') {
            useTortieAuth.getState().signOut();
            throw normalizeAuthFailure(err);
          }
        } finally {
          useTortieAuth.getState().signOut();
        }
      }),
    );
  }

  async sendEmailVerification(): Promise<void> {
    try {
      await this.gateway.sendEmailVerification();
    } catch (err) {
      throw normalizeAuthFailure(err);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      throw new AuthFlowError(emailCheck.code, emailCheck.message);
    }
    const normalized = normalizeEmail(email);
    trackAuth('password_reset_started', { provider: 'email' });
    await this.initialize();
    try {
      await this.gateway.sendPasswordReset(normalized);
    } catch (err) {
      throw normalizeAuthFailure(err);
    }
    try {
      await this.api.requestPasswordReset({ email: normalized });
    } catch {
      // The Firebase email is the user-facing reset. Audit can fail quietly.
    }
    void this.audit('PASSWORD_RESET_REQUESTED');
  }

  startPhoneVerification(phone: string): Promise<{ verificationId: string }> {
    return this.flight('phone-start', async () => {
      const checked = validatePhoneE164(phone);
      if (!checked.ok || !checked.e164) {
        throw new AuthFlowError(
          checked.ok ? AuthErrorCode.AUTH_PHONE_INVALID : checked.code,
          checked.ok ? undefined : checked.message,
        );
      }
      trackAuth('phone_verification_started', { provider: 'phone' });
      try {
        await this.api.phoneChallenge({ phoneNumber: checked.e164 });
      } catch (err) {
        throw normalizeAuthFailure(err);
      }
      await this.initialize();
      try {
        return await this.gateway.startPhoneVerification(checked.e164);
      } catch (err) {
        throw normalizeAuthFailure(err);
      }
    });
  }

  confirmPhoneVerification(
    verificationId: string,
    code: string,
  ): Promise<AuthResult> {
    return this.flight('phone-confirm', () =>
      this.interactiveCall(async () => {
        if (!verificationId || !code.trim()) {
          throw new AuthFlowError(AuthErrorCode.AUTH_PHONE_CODE_INVALID);
        }
        await this.initialize();
        let firebaseUser: FirebaseUserSnapshot;
        try {
          firebaseUser = await this.gateway.confirmPhoneCode(
            verificationId,
            code.trim(),
          );
        } catch (err) {
          throw normalizeAuthFailure(err);
        }
        const result = await this.bootstrap(firebaseUser, {});
        trackAuth('phone_verification_completed', { provider: 'phone' });
        void this.audit('USER_PHONE_VERIFIED');
        useTortieAuth.getState().setPendingPhoneVerification(false);
        return result;
      }),
    );
  }

  linkGoogle(hooks?: OAuthPromptHooks): Promise<void> {
    return this.linkIncoming(AuthProviderId.GOOGLE, 'google', () =>
      this.gateway.linkGoogle(hooks),
    );
  }

  linkFacebook(hooks?: OAuthPromptHooks): Promise<void> {
    return this.linkIncoming(AuthProviderId.FACEBOOK, 'facebook', () =>
      this.gateway.linkFacebook(hooks),
    );
  }

  linkEmailPassword(email: string, password: string): Promise<void> {
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return Promise.reject(new AuthFlowError(emailCheck.code, emailCheck.message));
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      return Promise.reject(
        new AuthFlowError(passwordCheck.code, passwordCheck.message),
      );
    }
    return this.linkIncoming(AuthProviderId.PASSWORD, 'password', () =>
      this.gateway.linkEmailPassword(normalizeEmail(email), password),
    );
  }

  linkPhone(verificationId: string, code: string): Promise<void> {
    return this.linkIncoming(AuthProviderId.PHONE, 'phone', () =>
      this.gateway.linkPhone(verificationId, code),
    );
  }

  async unlinkProvider(providerId: string): Promise<void> {
    return this.flight(`unlink:${providerId}`, async () => {
      if (!canUnlinkProvider(this.getProviders(), providerId)) {
        throw new AuthFlowError(AuthErrorCode.AUTH_LAST_PROVIDER);
      }
      let firebaseUser: FirebaseUserSnapshot;
      try {
        firebaseUser = await this.gateway.unlinkProvider(providerId);
      } catch (err) {
        throw normalizeAuthFailure(err);
      }
      void this.audit('PROVIDER_UNLINKED', {
        provider: providerLabel(providerId),
      });
      await this.refreshPublished(firebaseUser);
    });
  }

  async reauthenticate(input: ReauthenticateInput): Promise<void> {
    return this.flight('reauth', async () => {
      await this.initialize();
      try {
        await this.gateway.reauthenticate(input);
      } catch (err) {
        throw normalizeAuthFailure(err);
      }
    });
  }

  async updatePassword(password: string): Promise<void> {
    const checked = validatePassword(password);
    if (!checked.ok) throw new AuthFlowError(checked.code, checked.message);
    try {
      await this.gateway.updatePassword(password);
    } catch (err) {
      throw normalizeAuthFailure(err);
    }
    void this.audit('PASSWORD_CHANGED');
    await this.refreshUser().catch(() => undefined);
  }

  async updateEmail(email: string): Promise<void> {
    const checked = validateEmail(email);
    if (!checked.ok) throw new AuthFlowError(checked.code, checked.message);
    try {
      await this.gateway.updateEmail(normalizeEmail(email));
    } catch (err) {
      throw normalizeAuthFailure(err);
    }
    void this.audit('EMAIL_CHANGED');
    await this.refreshUser().catch(() => undefined);
  }

  /**
   * Caller reauthenticates first. API delete, then Firebase delete, then
   * local sign-out. Already-deleted users are treated as success.
   */
  async deleteAccount(): Promise<void> {
    return this.flight('delete', () =>
      this.interactiveCall(async () => {
        try {
          await this.api.deleteAccount();
        } catch (err) {
          if (!isAlreadyGone(err)) throw normalizeAuthFailure(err);
        }
        try {
          if (this.gateway.currentUser()) {
            await this.gateway.deleteCurrentUser();
          }
        } catch (err) {
          if (readErrorCode(err) !== 'auth/user-not-found') {
            throw normalizeAuthFailure(err);
          }
        }
        try {
          await this.gateway.signOut();
        } catch {
          // Already signed out.
        }
        useTortieAuth.getState().signOut();
        trackAuth('account_deleted');
        void this.audit('ACCOUNT_DELETED');
      }),
    );
  }

  async refreshUser(): Promise<ApplicationUser> {
    await this.initialize();
    let firebaseUser: FirebaseUserSnapshot;
    try {
      firebaseUser = await this.gateway.reload();
    } catch (err) {
      throw normalizeAuthFailure(err);
    }
    try {
      const me = await this.api.me();
      this.publish(firebaseUser, me);
      return me;
    } catch (err) {
      this.publishFailure(firebaseUser, err);
      throw normalizeAuthFailure(err);
    }
  }

  async completeOnboarding(input: {
    username: string;
    displayName: string;
  }): Promise<ApplicationUser> {
    return this.flight('onboarding', async () => {
      const usernameCheck = validateUsername(input.username);
      if (!usernameCheck.ok || !usernameCheck.username) {
        throw new AuthFlowError(
          usernameCheck.ok
            ? AuthErrorCode.AUTH_USERNAME_INVALID
            : usernameCheck.code,
          usernameCheck.ok ? undefined : usernameCheck.message,
        );
      }
      const displayName = input.displayName.trim();
      if (!displayName) {
        throw new AuthFlowError(
          AuthErrorCode.AUTH_UNKNOWN_ERROR,
          'Add your name so the people you cook with know it’s you.',
        );
      }
      try {
        await this.api.claimUsername(usernameCheck.username);
        const updated = await this.api.updateProfile({ displayName });
        const user: ApplicationUser = {
          ...updated,
          username: updated.username ?? usernameCheck.username,
          onboardingCompleted: true,
        };
        const firebaseUser = this.gateway.currentUser();
        if (firebaseUser) this.publish(firebaseUser, user);
        return user;
      } catch (err) {
        throw normalizeAuthFailure(err);
      }
    });
  }

  private async signInProvider(
    provider: 'google' | 'facebook',
    hooks?: OAuthPromptHooks,
  ): Promise<AuthResult> {
    trackAuth('login_started', { provider });
    trackAuth(provider === 'google' ? 'google_login' : 'facebook_login', {
      provider,
    });
    await this.initialize();
    let firebaseUser: FirebaseUserSnapshot;
    try {
      firebaseUser =
        provider === 'google'
          ? await this.gateway.signInWithGoogle(hooks)
          : await this.gateway.signInWithFacebook(hooks);
    } catch (err) {
      const normalized = normalizeAuthFailure(err);
      if (normalized.code !== AuthErrorCode.AUTH_PROVIDER_CANCELLED) {
        void this.audit('FAILED_LOGIN', {
          provider,
          reason: normalized.code,
        });
      }
      throw normalized;
    }
    const result = await this.bootstrap(firebaseUser, {});
    trackAuth(result.created ? 'signup_completed' : 'login_completed', {
      provider,
    });
    void this.audit(result.created ? 'USER_REGISTERED' : 'USER_LOGIN', {
      provider,
    });
    return result;
  }

  private async bootstrap(
    firebaseUser: FirebaseUserSnapshot,
    body: BootstrapBody,
  ): Promise<AuthResult> {
    try {
      await firebaseUser.getIdToken();
    } catch {
      // The request layer refreshes when the API asks.
    }
    try {
      const boot = await this.api.bootstrap(body);
      let current = firebaseUser;
      try {
        const linked = await this.gateway.consumePendingLink();
        if (linked) {
          current = linked;
          trackAuth('provider_linked');
          void this.audit('PROVIDER_LINKED');
        }
      } catch {
        // Sign-in stands. Linking can be retried from Profile.
      }
      this.publish(current, boot.user);
      return { user: boot.user, created: boot.created };
    } catch (err) {
      this.publishFailure(firebaseUser, err);
      throw normalizeAuthFailure(err);
    }
  }

  private async linkIncoming(
    providerId: string,
    label: string,
    run: () => Promise<FirebaseUserSnapshot>,
  ): Promise<void> {
    return this.flight(`link:${providerId}`, async () => {
      const plan = planProviderLink({
        currentProviders: this.getProviders(),
        incomingProvider: providerId,
      });
      if (plan.action === 'already-linked' || plan.action === 'reject') {
        throw new AuthFlowError(plan.code ?? AuthErrorCode.AUTH_UNKNOWN_ERROR);
      }
      await this.initialize();
      let firebaseUser: FirebaseUserSnapshot;
      try {
        firebaseUser = await run();
      } catch (err) {
        const next = planProviderLink({
          currentProviders: this.getProviders(),
          incomingProvider: providerId,
          firebaseError: readErrorCode(err),
        });
        if (next.action === 'sign-in-then-link') {
          throw new AuthFlowError(
            next.code ?? AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE,
          );
        }
        throw normalizeAuthFailure(err);
      }
      trackAuth('provider_linked', { provider: label });
      void this.audit('PROVIDER_LINKED', { provider: label });
      await this.refreshPublished(firebaseUser);
    });
  }

  private async refreshPublished(firebaseUser: FirebaseUserSnapshot) {
    try {
      const me = await this.api.me();
      this.publish(firebaseUser, me);
    } catch (err) {
      this.publishFailure(firebaseUser, err);
    }
  }

  private publish(firebaseUser: FirebaseUserSnapshot, appUser: ApplicationUser) {
    const prev = useTortieAuth.getState();
    useTortieAuth.setState(
      buildAuthSlice({
        initialized: true,
        firebaseUser,
        appUser,
        error: null,
        pendingPhoneVerification: prev.pendingPhoneVerification,
        previous: prev.user,
      }),
    );
    const user = useTortieAuth.getState().user;
    if (user) this.noteEmail(user);
  }

  private publishFailure(firebaseUser: FirebaseUserSnapshot, err: unknown) {
    const normalized = normalizeAuthFailure(err);
    const network =
      normalized.code === AuthErrorCode.AUTH_NETWORK_ERROR ||
      isNetworkFailure(err);
    const prev = useTortieAuth.getState();
    useTortieAuth.setState(
      buildAuthSlice({
        initialized: true,
        firebaseUser,
        appUser: null,
        failed: !network,
        networkError: network,
        error: normalized.message,
        pendingPhoneVerification: prev.pendingPhoneVerification,
        previous: prev.user,
      }),
    );
  }

  private noteEmail(user: TortieUser) {
    const unverified =
      (user.providers ?? []).includes(AuthProviderId.PASSWORD) &&
      !user.emailVerified;
    if (unverified) {
      this.sawUnverifiedEmail = true;
      return;
    }
    if (this.sawUnverifiedEmail && user.emailVerified) {
      this.sawUnverifiedEmail = false;
      trackAuth('email_verification_completed', { provider: 'email' });
      void this.audit('USER_EMAIL_VERIFIED');
    }
  }

  private async syncFromAuthState(user: FirebaseUserSnapshot | null) {
    if (!user) {
      useTortieAuth.setState(signedOutSlice());
      return;
    }
    try {
      await user.getIdToken();
      const boot = await this.api.bootstrap({});
      this.publish(user, boot.user);
    } catch (err) {
      this.publishFailure(user, err);
    }
  }

  private async audit(
    event: AuthEventBody['event'],
    extra?: { provider?: string; reason?: string },
  ) {
    try {
      await this.api.recordEvent({
        event,
        ...(extra?.provider ? { provider: extra.provider } : {}),
        ...(extra?.reason ? { reason: extra.reason } : {}),
      });
    } catch {
      // Audit is best-effort and must not block the kitchen.
    }
  }

  private flight<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.flights.get(key);
    if (existing) return existing as Promise<T>;
    const run = (async () => {
      this.status = 'busy';
      try {
        return await fn();
      } finally {
        this.flights.delete(key);
        if (this.flights.size === 0) this.status = 'idle';
      }
    })();
    this.flights.set(key, run);
    return run;
  }

  private async interactiveCall<T>(fn: () => Promise<T>): Promise<T> {
    this.interactive += 1;
    try {
      return await fn();
    } finally {
      this.interactive -= 1;
    }
  }
}

function isAlreadyGone(err: unknown): boolean {
  if (err instanceof ApiError) {
    return (
      err.status === 404 ||
      err.code === AuthErrorCode.AUTH_USER_NOT_FOUND
    );
  }
  return readErrorCode(err) === 'auth/user-not-found';
}

export function requiresEmailVerification(): boolean {
  return (
    useTortieAuth.getState().phase ===
    AuthPhase.AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED
  );
}

export { clearAuthAnalyticsBuffer, deriveAuthPhase };
