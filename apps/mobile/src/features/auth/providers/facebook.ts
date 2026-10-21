import { FacebookAuthProvider, type AuthCredential } from 'firebase/auth';

import { AuthError } from '@/features/auth/errors';
import { tNow } from '@/i18n/format';

type FacebookSdk = typeof import('react-native-fbsdk-next');

let sdk: FacebookSdk | null = null;

/** Loaded on first use so a binary without the native module still boots. */
function loadSdk(): FacebookSdk {
  if (!sdk) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy (see above)
      sdk = require('react-native-fbsdk-next') as FacebookSdk;
    } catch {
      throw new AuthError({
        kind: 'error',
        message:
          'Facebook sign-in is not available in this build. Rebuild the app with `npx expo run:android`.',
      });
    }
  }
  return sdk;
}

/** Facebook login dialog -> access token -> Firebase credential. */
export async function getFacebookCredential(): Promise<AuthCredential> {
  const { AccessToken, LoginManager } = loadSdk();
  let isCancelled: boolean;
  try {
    const result = await LoginManager.logInWithPermissions([
      'public_profile',
      'email',
    ]);
    isCancelled = result.isCancelled;
  } catch {
    throw new AuthError({
      kind: 'error',
      message: tNow('auth.errProviderFailed', { provider: 'Facebook' }),
    });
  }
  if (isCancelled) {
    throw new AuthError({ kind: 'cancelled' });
  }
  const token = await AccessToken.getCurrentAccessToken().catch(() => null);
  if (!token?.accessToken) {
    throw new AuthError({
      kind: 'error',
      message: tNow('auth.errProviderToken', { provider: 'Facebook' }),
    });
  }
  return FacebookAuthProvider.credential(token.accessToken);
}

/** Drops the Facebook session so the next login shows the dialog. Never throws. */
export function signOutOfFacebook(): void {
  if (!sdk) {
    // Never loaded this session, so there is no Facebook session to drop.
    return;
  }
  try {
    sdk.LoginManager.logOut();
  } catch {
    // Facebook SDK not initialised (for example before the first login).
  }
}
