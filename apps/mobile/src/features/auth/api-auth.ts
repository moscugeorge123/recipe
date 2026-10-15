import { getFirebaseAuth } from '@/features/auth/firebase';
import { authService } from '@/features/auth/auth-service';
import {
  setAuthTokenProvider,
  setUnauthorizedHandler,
} from '@/services/api-client';

/**
 * Wires the API client to Firebase: every request carries the current ID
 * token, and a request that is still 401 after a forced refresh signs the
 * user out. Imported once for its side effect from the root layout.
 */
setAuthTokenProvider(async (forceRefresh) => {
  const auth = getFirebaseAuth();
  // Wait for the persisted session to load so early requests are not anonymous.
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
});

let signingOut = false;
setUnauthorizedHandler(() => {
  // Several in-flight requests can fail together; sign out once.
  if (signingOut || !getFirebaseAuth().currentUser) return;
  signingOut = true;
  void authService.signOut().finally(() => {
    signingOut = false;
  });
});
