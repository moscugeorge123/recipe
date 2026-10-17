import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type AuthCredential,
  type User,
} from 'firebase/auth';

import { deleteAccountDoc, syncAccountDoc } from '@/features/auth/account-doc';
import { deleteStoredAvatar } from '@/features/auth/avatar-service';
import {
  AuthError,
  authErrorMessage,
  errorCode,
  toAuthError,
} from '@/features/auth/errors';
import { getFirebaseAuth } from '@/features/auth/firebase';
import {
  getFacebookCredential,
  signOutOfFacebook,
} from '@/features/auth/providers/facebook';
import {
  getGoogleCredential,
  signOutOfGoogle,
} from '@/features/auth/providers/google';
import { resetUserData } from '@/features/auth/reset-user-data';
import { apiClient } from '@/services/api-client';
import { useTortieAuth } from '@/tortie/auth-store';

export { AuthError } from '@/features/auth/errors';
export type { AuthFailure } from '@/features/auth/errors';

export type AuthResult = { isNewUser: boolean };

type SocialProvider = 'google' | 'facebook';

/**
 * A social credential Firebase refused because the email already belongs to
 * another sign-in method. It is linked to that account right after the user
 * signs in with the method they used before.
 */
type PendingLink = { credential: AuthCredential; email: string };
let pending: PendingLink | null = null;

const COLLISION_CODE = 'auth/account-exists-with-different-credential';
/** Firebase requires a sign-in within about 5 minutes to delete an account. */
const RECENT_SIGN_IN_MS = 4 * 60_000;
const USER_GONE_CODES = new Set([
  'auth/user-not-found',
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
]);

/** Pushes the latest Firebase user into the store (profile edits and links do not fire the token listener). */
function syncStore(): void {
  useTortieAuth.getState()._setFirebaseUser(getFirebaseAuth().currentUser);
}

function requireUser(): User {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new AuthError({
      kind: 'error',
      message: 'You’re signed out. Sign in and try again.',
    });
  }
  return user;
}

/** Completes a pending provider link once the user is signed in with the existing method. */
async function linkPending(user: User): Promise<void> {
  const link = pending;
  if (!link) {
    return;
  }
  const sameEmail =
    !link.email ||
    (user.email ?? '').toLowerCase() === link.email.toLowerCase();
  if (!sameEmail) {
    return;
  }
  pending = null;
  try {
    await linkWithCredential(user, link.credential);
    syncStore();
  } catch {
    // Already linked, or the provider token expired. Signing in still worked.
  }
}

async function existingProviderFor(
  email: string,
): Promise<'google' | 'facebook' | 'password'> {
  if (!email) {
    return 'password';
  }
  try {
    const methods = await fetchSignInMethodsForEmail(getFirebaseAuth(), email);
    if (methods.includes(GoogleAuthProvider.PROVIDER_ID)) return 'google';
    if (methods.includes(FacebookAuthProvider.PROVIDER_ID)) return 'facebook';
  } catch {
    // Fall through to the generic answer.
  }
  // Empty with email-enumeration protection on, so assume the common case.
  return 'password';
}

async function completeSignIn(credential: AuthCredential): Promise<AuthResult> {
  try {
    const result = await signInWithCredential(getFirebaseAuth(), credential);
    await linkPending(result.user);
    await syncAccountDoc(result.user);
    return { isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false };
  } catch (error) {
    if (errorCode(error) === COLLISION_CODE) {
      const customData = (error as { customData?: { email?: unknown } })
        .customData;
      const email =
        typeof customData?.email === 'string' ? customData.email : '';
      pending = { credential, email };
      throw new AuthError({
        kind: 'collision',
        email,
        existingProvider: await existingProviderFor(email),
      });
    }
    throw toAuthError(error);
  }
}

/** Runs an email/password call and converts every failure to an `AuthError`. */
async function attempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toAuthError(error);
  }
}

/** Signs out of Firebase and both social SDKs, then wipes the account's local data. */
async function clearSession(): Promise<void> {
  pending = null;
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch {
    // Keep going: local data must be wiped either way.
  }
  await signOutOfGoogle();
  signOutOfFacebook();
  await resetUserData();
}

export const authService = {
  async signUpWithEmail(
    name: string,
    email: string,
    pw: string,
  ): Promise<AuthResult> {
    return attempt(async () => {
      const result = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        pw,
      );
      await updateProfile(result.user, { displayName: name.trim() }).catch(
        () => undefined,
      );
      syncStore();
      await sendEmailVerification(result.user).catch(() => undefined);
      await linkPending(result.user);
      await syncAccountDoc(result.user);
      return { isNewUser: true };
    });
  },

  async signInWithEmail(email: string, pw: string): Promise<AuthResult> {
    return attempt(async () => {
      const result = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        pw,
      );
      await linkPending(result.user);
      await syncAccountDoc(result.user);
      return { isNewUser: false };
    });
  },

  async sendPasswordReset(email: string): Promise<void> {
    await attempt(() =>
      sendPasswordResetEmail(getFirebaseAuth(), email.trim()),
    );
  },

  async signInWithGoogle(): Promise<AuthResult> {
    return completeSignIn(await getGoogleCredential());
  },

  async signInWithFacebook(): Promise<AuthResult> {
    return completeSignIn(await getFacebookCredential());
  },

  /** Connects another provider to the signed-in account. */
  async linkProvider(provider: SocialProvider): Promise<void> {
    await attempt(async () => {
      const user = requireUser();
      const credential =
        provider === 'google'
          ? await getGoogleCredential()
          : await getFacebookCredential();
      await linkWithCredential(user, credential);
      syncStore();
      await syncAccountDoc(user);
    });
  },

  signOut: clearSession,

  /** Deletes server data, then the Firebase account. */
  async deleteAccount(): Promise<void> {
    await attempt(async () => {
      const user = requireUser();
      // Firebase rejects deletes without a recent sign-in. Check before the API
      // wipes the data, so a rejected delete can't leave an empty account behind.
      const lastSignIn = Date.parse(user.metadata.lastSignInTime ?? '');
      if (!(Date.now() - lastSignIn < RECENT_SIGN_IN_MS)) {
        throw new AuthError({
          kind: 'error',
          message:
            'For your security, sign in again, then delete your account.',
        });
      }
      await apiClient.delete('/me');
      // Firestore rules only let the owner delete it, so this runs before the auth user goes.
      await deleteAccountDoc(user.uid);
      await deleteStoredAvatar(user.uid);
      try {
        await user.delete();
      } catch (error) {
        const code = errorCode(error);
        if (code === 'auth/requires-recent-login') {
          throw new AuthError({
            kind: 'error',
            message:
              'For your security, sign in again, then delete your account.',
          });
        }
        // The API already removed the Firebase user when it has admin access.
        if (!code || !USER_GONE_CODES.has(code)) {
          throw new AuthError({
            kind: 'error',
            message: authErrorMessage(code),
          });
        }
      }
      await clearSession();
    });
  },
};
