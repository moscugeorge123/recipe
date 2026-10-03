const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function getApiBaseUrl(): string {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and restart Expo.',
    );
  }

  return API_URL.replace(/\/$/, '');
}

function publicEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Public Firebase client config. Missing values return null and never throw. */
export function getFirebaseApiKey(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_API_KEY');
}

export function getFirebaseAuthDomain(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
}

export function getFirebaseProjectId(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
}

export function getFirebaseStorageBucket(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
}

export function getFirebaseMessagingSenderId(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
}

export function getFirebaseAppId(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_APP_ID');
}

export function getFirebaseGoogleWebClientId(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID');
}

export function getFirebaseGoogleIosClientId(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_GOOGLE_IOS_CLIENT_ID');
}

export function getFirebaseFacebookAppId(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_FACEBOOK_APP_ID');
}

export function getFirebaseAppCheckDebugToken(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN');
}

export function getFirebaseAppCheckSiteKey(): string | null {
  return publicEnv('EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY');
}

/**
 * `EXPO_PUBLIC_API_URL` should include the API prefix, e.g.
 * `http://localhost:3000/api/v1` (Android emulator: `http://10.0.2.2:3000/api/v1`).
 * Feature modules then call paths like `/recipes` and `/recipes/extract`.
 */
