import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function getApiBaseUrl(): string {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and restart Expo.',
    );
  }

  return API_URL.replace(/\/$/, '');
}

/**
 * `EXPO_PUBLIC_API_URL` should include the API prefix, e.g.
 * `http://localhost:3000/api/v1` (Android emulator: `http://10.0.2.2:3000/api/v1`).
 * Feature modules then call paths like `/recipes` and `/recipes/extract`.
 */

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

/**
 * Firebase web config. Every value is a public identifier that ships in the
 * APK (see `.env.example`); none of them is a secret. Expo inlines
 * `process.env.EXPO_PUBLIC_*` only for literal property reads, so each one is
 * spelled out here.
 */
export function getFirebaseConfig(): FirebaseConfig {
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  const names: Record<keyof FirebaseConfig, string> = {
    apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
  };
  const missing = (Object.keys(names) as (keyof FirebaseConfig)[])
    .filter((key) => !config[key])
    .map((key) => names[key]);

  if (missing.length > 0) {
    throw new Error(
      `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set. Copy .env.example to .env, fill in the Firebase web app config and restart Expo.`,
    );
  }

  return config as FirebaseConfig;
}

/** OAuth "Web client ID" from Firebase Authentication > Google (not the Android client). */
export function getGoogleWebClientId(): string {
  // The FIREBASE_-prefixed name is accepted too: it is what some local .env files already use.
  const id =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    process.env.EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID;
  if (!id) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Copy .env.example to .env and restart Expo.',
    );
  }
  return id;
}

/** False when the build was made without the Facebook app id and client token (see `app.config.ts`). */
export function isFacebookEnabled(): boolean {
  return Constants.expoConfig?.extra?.facebookEnabled === true;
}
