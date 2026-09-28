import {
  AuthPhase,
  AuthProviderId,
  deriveAuthPhase,
  type ApplicationUser,
  type AppRole,
} from '@recipe/contracts';

import type { FirebaseUserSnapshot } from '@/auth/types';

export type AuthProv = 'google' | 'facebook' | 'email';

export type TortieUser = {
  name: string;
  email: string;
  prov: AuthProv;
  img: boolean;
  uid?: string;
  username?: string | null;
  phoneNumber?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  providers?: string[];
  onboardingCompleted?: boolean;
  role?: AppRole;
};

export type LinkedAccounts = {
  google: boolean;
  facebook: boolean;
  password: boolean;
  phone: boolean;
};

export const EMPTY_LINKED: LinkedAccounts = {
  google: false,
  facebook: false,
  password: false,
  phone: false,
};

export function toAuthProv(providerIds: readonly string[]): AuthProv {
  if (providerIds.includes(AuthProviderId.GOOGLE)) return 'google';
  if (providerIds.includes(AuthProviderId.FACEBOOK)) return 'facebook';
  return 'email';
}

export function linkedFromProviders(
  providerIds: readonly string[],
): LinkedAccounts {
  return {
    google: providerIds.includes(AuthProviderId.GOOGLE),
    facebook: providerIds.includes(AuthProviderId.FACEBOOK),
    password: providerIds.includes(AuthProviderId.PASSWORD),
    phone: providerIds.includes(AuthProviderId.PHONE),
  };
}

function providersOf(
  firebaseUser: FirebaseUserSnapshot,
  appUser: ApplicationUser | null,
): string[] {
  if (firebaseUser.providerIds.length) return [...firebaseUser.providerIds];
  return appUser?.providers ? [...appUser.providers] : [];
}

export function toTortieUser(
  firebaseUser: FirebaseUserSnapshot,
  appUser: ApplicationUser | null,
  previous?: TortieUser | null,
): TortieUser {
  const providers = providersOf(firebaseUser, appUser);
  const username = appUser?.username ?? previous?.username ?? null;
  return {
    name: appUser?.displayName || firebaseUser.displayName || previous?.name || '',
    email: appUser?.email || firebaseUser.email || previous?.email || '',
    prov: toAuthProv(providers),
    img: Boolean(appUser?.photoURL || firebaseUser.photoURL),
    uid: firebaseUser.uid,
    username,
    phoneNumber:
      appUser?.phoneNumber ?? firebaseUser.phoneNumber ?? previous?.phoneNumber ?? null,
    emailVerified: firebaseUser.emailVerified || Boolean(appUser?.emailVerified),
    phoneVerified: Boolean(appUser?.phoneVerified || firebaseUser.phoneNumber),
    providers,
    onboardingCompleted: appUser
      ? appUser.onboardingCompleted || Boolean(appUser.username)
      : Boolean(previous?.onboardingCompleted),
    role: appUser?.role ?? previous?.role ?? 'USER',
  };
}

export type SessionSlice = {
  phase: AuthPhase;
  authed: boolean;
  user: TortieUser | null;
  linked: LinkedAccounts;
  error: string | null;
  pendingPhoneVerification: boolean;
};

export function signedOutSlice(error: string | null = null): SessionSlice {
  return {
    phase: AuthPhase.UNAUTHENTICATED,
    authed: false,
    user: null,
    linked: { ...EMPTY_LINKED },
    error,
    pendingPhoneVerification: false,
  };
}

export function buildAuthSlice(input: {
  initialized: boolean;
  firebaseUser: FirebaseUserSnapshot | null;
  appUser: ApplicationUser | null;
  failed?: boolean;
  networkError?: boolean;
  error?: string | null;
  pendingPhoneVerification?: boolean;
  previous?: TortieUser | null;
}): SessionSlice {
  const pending = input.pendingPhoneVerification ?? false;
  if (!input.initialized) {
    return {
      phase: AuthPhase.INITIALIZING,
      authed: false,
      user: null,
      linked: { ...EMPTY_LINKED },
      error: null,
      pendingPhoneVerification: false,
    };
  }
  if (!input.firebaseUser) {
    return {
      phase: input.failed
        ? AuthPhase.AUTHENTICATION_ERROR
        : AuthPhase.UNAUTHENTICATED,
      authed: false,
      user: null,
      linked: { ...EMPTY_LINKED },
      error: input.error ?? null,
      pendingPhoneVerification: false,
    };
  }

  const providers = providersOf(input.firebaseUser, input.appUser);
  const emailVerified =
    input.firebaseUser.emailVerified || Boolean(input.appUser?.emailVerified);
  const username =
    input.appUser?.username ??
    (input.networkError ? (input.previous?.username ?? null) : null);
  const onboardingCompleted = input.appUser
    ? input.appUser.onboardingCompleted || Boolean(input.appUser.username)
    : input.networkError
      ? Boolean(input.previous?.onboardingCompleted || input.previous?.username)
      : false;
  const network = Boolean(input.networkError);
  const failed = Boolean(input.failed) && !network;
  const appUserLoaded = input.appUser
    ? true
    : network
      ? Boolean(input.previous)
      : false;

  const phase = failed
    ? AuthPhase.AUTHENTICATION_ERROR
    : deriveAuthPhase({
        initialized: true,
        failed: false,
        hasFirebaseUser: true,
        appUserLoaded,
        username,
        onboardingCompleted,
        emailVerificationBlocking:
          providers.includes(AuthProviderId.PASSWORD) && !emailVerified,
        phoneVerificationBlocking: pending,
      });

  return {
    phase,
    authed: true,
    user: toTortieUser(input.firebaseUser, input.appUser, input.previous),
    linked: linkedFromProviders(providers),
    error: input.error ?? null,
    pendingPhoneVerification: pending,
  };
}

export const firstName = (user: TortieUser | null) =>
  (user?.name ?? '').split(' ')[0] || 'there';
