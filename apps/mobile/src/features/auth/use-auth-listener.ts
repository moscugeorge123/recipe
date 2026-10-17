import AsyncStorage from '@react-native-async-storage/async-storage';
import { onIdTokenChanged } from 'firebase/auth';
import { useEffect } from 'react';

import { getFirebaseAuth } from '@/features/auth/firebase';
import { resetUserData } from '@/features/auth/reset-user-data';
import { useTortieAuth } from '@/tortie/auth-store';

const LAST_UID_KEY = 'tortie.auth.last-uid';

/**
 * If the account changed without a clean sign-out (app killed mid sign-out, a
 * 401-triggered sign-out that never finished), the previous user's local data
 * is still on disk. Wipe it before the new account sees it.
 */
async function wipeIfAccountChanged(uid: string): Promise<void> {
  try {
    const last = await AsyncStorage.getItem(LAST_UID_KEY);
    if (last && last !== uid) {
      await resetUserData();
    }
    await AsyncStorage.setItem(LAST_UID_KEY, uid);
  } catch {
    // Best-effort; sign-out already wipes in the normal path.
  }
}

/**
 * Mirrors the Firebase session into `useTortieAuth`. Mount once in the root
 * layout. Firebase restores the persisted session before the first callback,
 * so `status` leaves `loading` exactly once at startup.
 */
export function useAuthListener(): void {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let latest = 0;
    try {
      unsubscribe = onIdTokenChanged(getFirebaseAuth(), (user) => {
        const seq = ++latest;
        void (async () => {
          // The previous account's data must be gone before the new user is
          // published: screens mount on it and would briefly show that data.
          if (user) await wipeIfAccountChanged(user.uid);
          if (seq === latest) {
            useTortieAuth.getState()._setFirebaseUser(user);
          }
        })();
      });
    } catch (error) {
      // Missing Firebase config: show the sign-in screen, whose actions
      // surface the configuration error, instead of a permanent splash.
      console.warn(error instanceof Error ? error.message : error);
      useTortieAuth.getState()._setFirebaseUser(null);
    }
    return () => unsubscribe?.();
  }, []);
}
