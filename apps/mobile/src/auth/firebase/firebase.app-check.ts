import {
  CustomProvider,
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';
import { Platform } from 'react-native';

import { getFirebaseApp, readFirebaseConfig } from '@/auth/firebase/firebase.config';

/**
 * Production Android uses Play Integrity and iOS uses App Attest.
 * Enforcement stays off until traffic is monitored.
 * This module only attaches a token when one can be minted. Native builds
 * without Play Integrity return null instead of throwing into the UI.
 */

let appCheck: AppCheck | null = null;
let attempted = false;

function installWebDebugToken(token: string) {
  const scope = globalThis as typeof globalThis & {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  };
  scope.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  if (typeof self !== 'undefined') {
    (
      self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }
}

function ensureAppCheck(): AppCheck | null {
  if (attempted) return appCheck;
  attempted = true;
  const app = getFirebaseApp();
  if (!app) return null;

  const { appCheckDebugToken, appCheckRecaptchaSiteKey } = readFirebaseConfig();
  if (appCheckDebugToken) installWebDebugToken(appCheckDebugToken);

  try {
    if (appCheckRecaptchaSiteKey && Platform.OS === 'web') {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckRecaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return appCheck;
    }
    if (appCheckDebugToken) {
      appCheck = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: () =>
            Promise.resolve({
              token: appCheckDebugToken,
              expireTimeMillis: Date.now() + 60 * 60 * 1000,
            }),
        }),
        isTokenAutoRefreshEnabled: false,
      });
      return appCheck;
    }
    return null;
  } catch {
    appCheck = null;
    return null;
  }
}

export async function getAppCheckToken(): Promise<string | null> {
  try {
    const instance = ensureAppCheck();
    if (!instance) return null;
    const result = await getToken(instance, false);
    return result.token || null;
  } catch {
    return null;
  }
}
