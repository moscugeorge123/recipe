import { GoogleAuthProvider, type AuthCredential } from 'firebase/auth';

import { getGoogleWebClientId } from '@/constants/env';
import { AuthError } from '@/features/auth/errors';

type GoogleSigninModule =
  typeof import('@react-native-google-signin/google-signin');

let sdk: GoogleSigninModule | null = null;

/**
 * Loaded on first use: importing it at module scope throws in a binary built
 * without the native module (Expo Go, a stale dev build) and takes every
 * route down with it.
 */
function loadSdk(): GoogleSigninModule {
  if (!sdk) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy (see above)
      const loaded = require('@react-native-google-signin/google-signin');
      sdk = loaded as GoogleSigninModule;
    } catch {
      throw new AuthError({
        kind: 'error',
        message:
          'Google sign-in is not available in this build. Rebuild the app with `npx expo run:android`.',
      });
    }
  }
  return sdk;
}

let configured = false;

function configure(): GoogleSigninModule {
  const google = loadSdk();
  if (!configured) {
    google.GoogleSignin.configure({ webClientId: getGoogleWebClientId() });
    configured = true;
  }
  return google;
}

/** Native account picker -> Google ID token -> Firebase credential. */
export async function getGoogleCredential(): Promise<AuthCredential> {
  let google: GoogleSigninModule;
  try {
    google = configure();
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError({
      kind: 'error',
      message: 'Google sign-in failed. Try again.',
    });
  }
  const {
    GoogleSignin,
    isCancelledResponse,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
  } = google;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      throw new AuthError({ kind: 'cancelled' });
    }
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new AuthError({
        kind: 'error',
        message: 'Google did not return a sign-in token. Try again.',
      });
    }
    return GoogleAuthProvider.credential(response.data.idToken);
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new AuthError({ kind: 'cancelled' });
        case statusCodes.IN_PROGRESS:
          throw new AuthError({
            kind: 'error',
            message:
              'Google sign-in is already open. Finish it or close it, then try again.',
          });
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new AuthError({
            kind: 'error',
            message:
              'Google Play services is missing or out of date on this device.',
          });
      }
    }
    throw new AuthError({
      kind: 'error',
      message: 'Google sign-in failed. Try again.',
    });
  }
}

/** Clears the cached Google account so the picker shows again. Never throws. */
export async function signOutOfGoogle(): Promise<void> {
  if (!configured) {
    // Never used this session, so there is no Google account to forget.
    return;
  }
  try {
    await loadSdk().GoogleSignin.signOut();
  } catch {
    // Not signed in with Google.
  }
}
