import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthPhase, AuthProviderId, deriveAuthPhase } from '@recipe/contracts';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  EMPTY_LINKED,
  firstName,
  linkedFromProviders,
  type AuthProv,
  type LinkedAccounts,
  type TortieUser,
} from '@/auth/state/auth.store';

export type { AuthProv, TortieUser };
export { firstName };

/**
 * Live account state. `authed` and `phase` are set from Firebase
 * `onAuthStateChanged` plus bootstrap — AsyncStorage is only a display-name
 * cache and is not treated as a session.
 */
type AuthState = {
  phase: AuthPhase;
  authed: boolean;
  user: TortieUser | null;
  linked: LinkedAccounts;
  error: string | null;
  pendingPhoneVerification: boolean;
  /** Display-name cache. Never used as proof of login. */
  cachedName: string | null;
  signIn: (user: TortieUser) => void;
  signOut: () => void;
  link: (key: 'google' | 'facebook') => void;
  setPendingPhoneVerification: (value: boolean) => void;
};

export const useTortieAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      phase: AuthPhase.INITIALIZING,
      authed: false,
      user: null,
      linked: { ...EMPTY_LINKED },
      error: null,
      pendingPhoneVerification: false,
      cachedName: null,
      signIn: (user) =>
        set({
          authed: true,
          phase: AuthPhase.AUTHENTICATED,
          user,
          error: null,
          linked: linkedFromProviders(
            user.providers ?? [
              user.prov === 'google'
                ? AuthProviderId.GOOGLE
                : user.prov === 'facebook'
                  ? AuthProviderId.FACEBOOK
                  : AuthProviderId.PASSWORD,
            ],
          ),
        }),
      signOut: () =>
        set({
          authed: false,
          phase: AuthPhase.UNAUTHENTICATED,
          user: null,
          linked: { ...EMPTY_LINKED },
          error: null,
          pendingPhoneVerification: false,
        }),
      link: (key) =>
        set((state) => ({ linked: { ...state.linked, [key]: true } })),
      setPendingPhoneVerification: (value) => {
        const state = get();
        if (
          !state.authed ||
          !state.user ||
          state.phase === AuthPhase.AUTHENTICATION_ERROR ||
          state.phase === AuthPhase.INITIALIZING
        ) {
          set({ pendingPhoneVerification: value });
          return;
        }
        const providers = state.user.providers ?? [];
        const phase = deriveAuthPhase({
          initialized: true,
          failed: false,
          hasFirebaseUser: true,
          appUserLoaded: true,
          username: state.user.username ?? null,
          onboardingCompleted: Boolean(
            state.user.onboardingCompleted || state.user.username,
          ),
          emailVerificationBlocking:
            providers.includes(AuthProviderId.PASSWORD) &&
            !state.user.emailVerified,
          phoneVerificationBlocking: value,
        });
        set({ pendingPhoneVerification: value, phase });
      },
    }),
    {
      name: 'tortie-auth',
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
      partialize: (state) => ({ cachedName: state.user?.name ?? state.cachedName }),
      merge: (persisted, current) => {
        const cached = persisted as { cachedName?: string | null } | undefined;
        return {
          ...current,
          cachedName: cached?.cachedName ?? null,
          authed: false,
          phase: AuthPhase.INITIALIZING,
          user: null,
          error: null,
          pendingPhoneVerification: false,
        };
      },
    },
  ),
);
