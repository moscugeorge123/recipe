import { useEffect } from 'react';
import { AuthPhase, type AppRole } from '@recipe/contracts';

import { getAppCheckToken } from '@/auth/firebase/firebase.app-check';
import { authService } from '@/auth/instance';
import { requiresEmailVerification } from '@/auth/services/auth.service';
import {
  setAppCheckTokenProvider,
  setAuthTokenProvider,
} from '@/services/api-client';
import { useTortieAuth } from '@/tortie/auth-store';
import { useNav } from '@/tortie/nav-store';

export function useAuth() {
  const phase = useTortieAuth((s) => s.phase);
  const authed = useTortieAuth((s) => s.authed);
  const user = useTortieAuth((s) => s.user);
  const linked = useTortieAuth((s) => s.linked);
  const error = useTortieAuth((s) => s.error);
  return { phase, authed, user, linked, error, service: authService };
}

export function useCurrentUser() {
  return useTortieAuth((s) => s.user);
}

export function useAuthLifecycle() {
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    setAuthTokenProvider((force) => authService.getIdToken(Boolean(force)));
    setAppCheckTokenProvider(() => getAppCheckToken());
    void authService
      .initialize()
      .then(() => {
        if (cancelled) return;
        stop = authService.subscribe();
      })
      .catch(() => {
        useTortieAuth.getState().signOut();
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
}

/** Opens login when the phase is signed out. Returns false in that case. */
export function useRequireAuth(): () => boolean {
  return () => {
    if (useTortieAuth.getState().phase === AuthPhase.UNAUTHENTICATED) {
      useNav.getState().openAuth('login');
      return false;
    }
    return true;
  };
}

export function useRequireGuest(): boolean {
  return useTortieAuth((s) => s.phase) === AuthPhase.UNAUTHENTICATED;
}

export function useRequireOnboarding(): boolean {
  return (
    useTortieAuth((s) => s.phase) === AuthPhase.AUTHENTICATED_ONBOARDING_REQUIRED
  );
}

export function useRequireEmailVerification(): boolean {
  return useTortieAuth(
    (s) => s.phase === AuthPhase.AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED,
  );
}

export function useRequirePhoneVerification(): boolean {
  return useTortieAuth(
    (s) => s.phase === AuthPhase.AUTHENTICATED_PHONE_VERIFICATION_REQUIRED,
  );
}

export function useRequireAdmin(role: AppRole | null | undefined): boolean {
  return role === 'ADMIN';
}

export { requiresEmailVerification };
