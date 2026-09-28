import {
  AuthErrorCode,
  AuthProviderId,
  authErrorMessage,
  canUnlinkProvider,
  planProviderLink,
  type ApplicationUser,
} from '@recipe/contracts';

import { clearAuthAnalyticsBuffer } from '@/auth/analytics';
import { normalizeAuthFailure } from '@/auth/services/auth-error';
import type { AuthApi, BootstrapBody } from '@/auth/services/auth-api';
import { AuthService } from '@/auth/services/auth.service';
import type { AuthGateway, FirebaseUserSnapshot } from '@/auth/types';
import { ApiError } from '@/services/api-client';
import { useTortieAuth } from '@/tortie/auth-store';

const PASSWORD = 'KitchenNight1';

function snapshot(
  partial: Partial<FirebaseUserSnapshot> & { uid: string },
): FirebaseUserSnapshot {
  return {
    uid: partial.uid,
    email: partial.email ?? 'elena@example.com',
    emailVerified: partial.emailVerified ?? true,
    phoneNumber: partial.phoneNumber ?? null,
    displayName: partial.displayName ?? 'Elena Moretti',
    photoURL: partial.photoURL ?? null,
    isAnonymous: partial.isAnonymous ?? false,
    providerIds: partial.providerIds ?? ['password'],
    getIdToken: () => Promise.resolve(`token:${partial.uid}`),
  };
}

function appUser(
  uid: string,
  extra: Partial<ApplicationUser> = {},
): ApplicationUser {
  return {
    id: `app-${uid}`,
    uid,
    username: 'elena',
    usernameNormalized: 'elena',
    email: 'elena@example.com',
    displayName: 'Elena Moretti',
    photoURL: null,
    phoneNumber: null,
    emailVerified: true,
    phoneVerified: false,
    providers: ['password'],
    onboardingCompleted: true,
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

class FakeGateway implements AuthGateway {
  user: FirebaseUserSnapshot | null = null;
  emails: string[] = [];
  registers: string[] = [];
  phoneStarts = 0;
  unlinks: string[] = [];
  linkGoogleCalls = 0;

  initialize(): Promise<void> {
    return Promise.resolve();
  }
  onAuthStateChanged(): () => void {
    return () => undefined;
  }
  currentUser(): FirebaseUserSnapshot | null {
    return this.user;
  }
  getIdToken(): Promise<string | null> {
    return Promise.resolve(this.user ? `token:${this.user.uid}` : null);
  }
  async signInWithEmail(email: string): Promise<FirebaseUserSnapshot> {
    this.emails.push(email);
    this.user = snapshot({
      uid: 'uid-1',
      email,
      providerIds: ['password'],
    });
    return this.user;
  }
  async registerWithEmail(email: string): Promise<FirebaseUserSnapshot> {
    this.registers.push(email);
    this.user = snapshot({
      uid: 'uid-1',
      email,
      emailVerified: false,
      providerIds: ['password'],
    });
    return this.user;
  }
  async signInWithGoogle(): Promise<FirebaseUserSnapshot> {
    this.user = snapshot({
      uid: 'uid-1',
      providerIds: [AuthProviderId.GOOGLE],
    });
    return this.user;
  }
  async signInWithFacebook(): Promise<FirebaseUserSnapshot> {
    this.user = snapshot({
      uid: 'uid-1',
      providerIds: [AuthProviderId.FACEBOOK],
    });
    return this.user;
  }
  async signInAnonymously(): Promise<FirebaseUserSnapshot> {
    this.user = snapshot({
      uid: 'uid-anon',
      email: null,
      providerIds: [AuthProviderId.ANONYMOUS],
      isAnonymous: true,
    });
    return this.user;
  }
  async signOut(): Promise<void> {
    this.user = null;
  }
  async sendEmailVerification(): Promise<void> {}
  async reload(): Promise<FirebaseUserSnapshot> {
    if (!this.user) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
    return this.user;
  }
  async sendPasswordReset(): Promise<void> {}
  async linkGoogle(): Promise<FirebaseUserSnapshot> {
    this.linkGoogleCalls += 1;
    if (!this.user) throw new Error('no user');
    return this.user;
  }
  async linkFacebook(): Promise<FirebaseUserSnapshot> {
    if (!this.user) throw new Error('no user');
    return this.user;
  }
  async linkEmailPassword(): Promise<FirebaseUserSnapshot> {
    if (!this.user) throw new Error('no user');
    return this.user;
  }
  async linkPhone(): Promise<FirebaseUserSnapshot> {
    if (!this.user) throw new Error('no user');
    return this.user;
  }
  async startPhoneVerification(): Promise<{ verificationId: string }> {
    this.phoneStarts += 1;
    return { verificationId: 'ver-1' };
  }
  async confirmPhoneCode(): Promise<FirebaseUserSnapshot> {
    if (!this.user) throw new Error('no user');
    return this.user;
  }
  async unlinkProvider(providerId: string): Promise<FirebaseUserSnapshot> {
    this.unlinks.push(providerId);
    if (!this.user) throw new Error('no user');
    return this.user;
  }
  async reauthenticate(): Promise<void> {}
  async updateEmail(): Promise<void> {}
  async updatePassword(): Promise<void> {}
  async deleteCurrentUser(): Promise<void> {
    this.user = null;
  }
  async consumePendingLink(): Promise<FirebaseUserSnapshot | null> {
    return null;
  }
}

function createApi(gateway: FakeGateway, options?: { phoneFails?: boolean }) {
  const bootstraps: { body: BootstrapBody; uid: string | null }[] = [];
  const api: AuthApi = {
    async bootstrap(body) {
      const payload = body ?? {};
      bootstraps.push({
        body: payload,
        uid: gateway.currentUser()?.uid ?? null,
      });
      const current = gateway.currentUser();
      return {
        user: appUser(current?.uid ?? 'missing', {
          email: current?.email ?? null,
          providers: current?.providerIds ?? ['password'],
          emailVerified: current?.emailVerified ?? false,
        }),
        created: false,
      };
    },
    async me() {
      const current = gateway.currentUser();
      return appUser(current?.uid ?? 'missing', {
        providers: current?.providerIds ?? [],
      });
    },
    async updateProfile() {
      const current = gateway.currentUser();
      return appUser(current?.uid ?? 'missing');
    },
    async checkUsername() {
      return { available: true };
    },
    async claimUsername(username) {
      const current = gateway.currentUser();
      return appUser(current?.uid ?? 'missing', { username, onboardingCompleted: true });
    },
    async deleteAccount() {},
    async recordEvent() {},
    async phoneChallenge() {
      if (options?.phoneFails) {
        throw new ApiError('slow down', 429, null, 'AUTH_TOO_MANY_REQUESTS');
      }
    },
    async requestPasswordReset() {},
  };
  return { api, bootstraps };
}

function resetStore() {
  useTortieAuth.setState({
    authed: false,
    phase: 'INITIALIZING',
    user: null,
    linked: { google: false, facebook: false, password: false, phone: false },
    error: null,
    pendingPhoneVerification: false,
    cachedName: null,
  });
  clearAuthAnalyticsBuffer();
}

describe('AuthService', () => {
  beforeEach(() => {
    resetStore();
  });

  test('register bootstraps with the firebase uid and no uid in the body', async () => {
    const gateway = new FakeGateway();
    const { api, bootstraps } = createApi(gateway);
    const service = new AuthService(gateway, api);

    await service.registerWithEmail({
      email: 'Elena@Example.com',
      password: PASSWORD,
      username: 'elena',
      displayName: 'Elena Moretti',
    });

    expect(gateway.registers).toEqual(['elena@example.com']);
    expect(bootstraps).toHaveLength(1);
    expect(bootstraps[0]?.uid).toBe('uid-1');
    expect(bootstraps[0]?.body).toEqual({
      username: 'elena',
      displayName: 'Elena Moretti',
    });
    expect(bootstraps[0]?.body).not.toHaveProperty('uid');
    expect(JSON.stringify(useTortieAuth.getState())).not.toContain('token:');
    expect(useTortieAuth.getState().authed).toBe(true);
  });

  test('login twice bootstraps the same firebase uid without sending uid', async () => {
    const gateway = new FakeGateway();
    const { api, bootstraps } = createApi(gateway);
    const service = new AuthService(gateway, api);

    await service.signInWithEmail({
      email: 'elena@example.com',
      password: PASSWORD,
    });
    await service.signInWithEmail({
      email: 'elena@example.com',
      password: PASSWORD,
    });

    expect(bootstraps).toHaveLength(2);
    expect(bootstraps.map((entry) => entry.uid)).toEqual(['uid-1', 'uid-1']);
    for (const entry of bootstraps) {
      expect(entry.body).not.toHaveProperty('uid');
    }
  });

  test('does not unlink the last provider', async () => {
    const gateway = new FakeGateway();
    const { api } = createApi(gateway);
    const service = new AuthService(gateway, api);
    await service.signInWithEmail({
      email: 'elena@example.com',
      password: PASSWORD,
    });

    await expect(service.unlinkProvider(AuthProviderId.PASSWORD)).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_LAST_PROVIDER,
      message: authErrorMessage(AuthErrorCode.AUTH_LAST_PROVIDER),
    });
    expect(gateway.unlinks).toEqual([]);
  });

  test('refuses to link a provider that is already connected', async () => {
    const gateway = new FakeGateway();
    const { api } = createApi(gateway);
    const service = new AuthService(gateway, api);
    await service.signInWithGoogle();

    await expect(service.linkGoogle()).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_PROVIDER_ALREADY_LINKED,
    });
    expect(gateway.linkGoogleCalls).toBe(0);
  });

  test('sign out clears authed', async () => {
    const gateway = new FakeGateway();
    const { api } = createApi(gateway);
    const service = new AuthService(gateway, api);
    await service.signInWithEmail({
      email: 'elena@example.com',
      password: PASSWORD,
    });
    expect(useTortieAuth.getState().authed).toBe(true);

    await service.signOut();

    expect(useTortieAuth.getState().authed).toBe(false);
    expect(useTortieAuth.getState().user).toBeNull();
  });

  test('a failed phone challenge does not start Firebase verification', async () => {
    const gateway = new FakeGateway();
    const { api } = createApi(gateway, { phoneFails: true });
    const service = new AuthService(gateway, api);

    await expect(service.startPhoneVerification('+40722111222')).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_TOO_MANY_REQUESTS,
      message: expect.not.stringContaining('auth/'),
    });
    expect(gateway.phoneStarts).toBe(0);
  });

  test('normalized errors never include a raw auth/ code', async () => {
    const samples = [
      'auth/wrong-password',
      'auth/not-configured',
      'auth/operation-not-supported',
      'auth/credential-already-in-use',
      'auth/popup-closed-by-user',
    ];
    for (const code of samples) {
      const error = normalizeAuthFailure(
        Object.assign(new Error(`Firebase: Error (${code}).`), { code }),
      );
      expect(error.message).not.toContain('auth/');
      expect(error.message.length).toBeGreaterThan(0);
    }

    const gateway = new FakeGateway();
    gateway.signInWithEmail = async () => {
      throw Object.assign(new Error('Firebase: Error (auth/wrong-password).'), {
        code: 'auth/wrong-password',
      });
    };
    const { api } = createApi(gateway);
    const service = new AuthService(gateway, api);
    await expect(
      service.signInWithEmail({ email: 'elena@example.com', password: PASSWORD }),
    ).rejects.toMatchObject({
      message: expect.not.stringContaining('auth/'),
    });
  });
});

describe('planProviderLink', () => {
  test('email to google links', () => {
    expect(
      planProviderLink({
        currentProviders: [AuthProviderId.PASSWORD],
        incomingProvider: AuthProviderId.GOOGLE,
      }),
    ).toEqual({ action: 'link' });
  });

  test('google to phone links', () => {
    expect(
      planProviderLink({
        currentProviders: [AuthProviderId.GOOGLE],
        incomingProvider: AuthProviderId.PHONE,
      }),
    ).toEqual({ action: 'link' });
  });

  test('facebook to email links', () => {
    expect(
      planProviderLink({
        currentProviders: [AuthProviderId.FACEBOOK],
        incomingProvider: AuthProviderId.PASSWORD,
      }),
    ).toEqual({ action: 'link' });
  });

  test('already linked', () => {
    expect(
      planProviderLink({
        currentProviders: [AuthProviderId.GOOGLE],
        incomingProvider: AuthProviderId.GOOGLE,
      }),
    ).toEqual({
      action: 'already-linked',
      code: AuthErrorCode.AUTH_PROVIDER_ALREADY_LINKED,
    });
  });

  test('unlink last usable method is refused, anonymous does not count', () => {
    expect(canUnlinkProvider([AuthProviderId.PASSWORD], AuthProviderId.PASSWORD)).toBe(
      false,
    );
    expect(
      canUnlinkProvider(
        [AuthProviderId.ANONYMOUS, AuthProviderId.PASSWORD],
        AuthProviderId.PASSWORD,
      ),
    ).toBe(false);
    expect(
      canUnlinkProvider(
        [AuthProviderId.PASSWORD, AuthProviderId.GOOGLE],
        AuthProviderId.PASSWORD,
      ),
    ).toBe(true);
  });

  test('anonymous to google links', () => {
    expect(
      planProviderLink({
        currentProviders: [AuthProviderId.ANONYMOUS],
        incomingProvider: AuthProviderId.GOOGLE,
      }),
    ).toEqual({ action: 'link' });
  });

  test('credential collision signs in then links', () => {
    expect(
      planProviderLink({
        currentProviders: [AuthProviderId.PASSWORD],
        incomingProvider: AuthProviderId.GOOGLE,
        firebaseError: 'auth/credential-already-in-use',
      }).action,
    ).toBe('sign-in-then-link');
  });
});
