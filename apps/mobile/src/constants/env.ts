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
