import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';

import type { AppConfig } from '../../config/env.js';

const FIREBASE_APP_NAME = 'tortie-api';

export type AuthConfig = AppConfig['auth'];

/** `FIREBASE_SERVICE_ACCOUNT_JSON` is validated at startup, so a failure here is a bug. */
export function decodeServiceAccount(encoded: string): ServiceAccount {
  const key = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };

  return { projectId: key.project_id, clientEmail: key.client_email, privateKey: key.private_key };
}

/**
 * Returns the process-wide Firebase Admin app, creating it on first use. Token verification only
 * needs the project id; the service-account credential is attached when configured and is what
 * enables deleting users and checking revocation.
 */
export function getFirebaseApp(auth: AuthConfig): App {
  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existing) {
    return getApp(FIREBASE_APP_NAME);
  }

  const projectId = auth.firebaseProjectId;
  if (projectId === undefined) {
    throw new Error('FIREBASE_PROJECT_ID is required to initialise Firebase');
  }

  return initializeApp(
    {
      projectId,
      ...(auth.firebaseServiceAccountJson !== undefined
        ? { credential: cert(decodeServiceAccount(auth.firebaseServiceAccountJson)) }
        : {}),
    },
    FIREBASE_APP_NAME,
  );
}
