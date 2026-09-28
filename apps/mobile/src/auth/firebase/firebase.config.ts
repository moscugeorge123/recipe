import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import {
  getFirebaseApiKey,
  getFirebaseAppCheckDebugToken,
  getFirebaseAppCheckSiteKey,
  getFirebaseAppId,
  getFirebaseAuthDomain,
  getFirebaseFacebookAppId,
  getFirebaseGoogleIosClientId,
  getFirebaseGoogleWebClientId,
  getFirebaseMessagingSenderId,
  getFirebaseProjectId,
  getFirebaseStorageBucket,
} from '@/constants/env';

export type FirebasePublicConfig = {
  apiKey: string | null;
  authDomain: string | null;
  projectId: string | null;
  storageBucket: string | null;
  messagingSenderId: string | null;
  appId: string | null;
  googleWebClientId: string | null;
  googleIosClientId: string | null;
  facebookAppId: string | null;
  appCheckDebugToken: string | null;
  appCheckRecaptchaSiteKey: string | null;
};

export function readFirebaseConfig(): FirebasePublicConfig {
  return {
    apiKey: getFirebaseApiKey(),
    authDomain: getFirebaseAuthDomain(),
    projectId: getFirebaseProjectId(),
    storageBucket: getFirebaseStorageBucket(),
    messagingSenderId: getFirebaseMessagingSenderId(),
    appId: getFirebaseAppId(),
    googleWebClientId: getFirebaseGoogleWebClientId(),
    googleIosClientId: getFirebaseGoogleIosClientId(),
    facebookAppId: getFirebaseFacebookAppId(),
    appCheckDebugToken: getFirebaseAppCheckDebugToken(),
    appCheckRecaptchaSiteKey: getFirebaseAppCheckSiteKey(),
  };
}

export function isFirebaseConfigured(): boolean {
  const config = readFirebaseConfig();
  return Boolean(
    config.apiKey && config.authDomain && config.projectId && config.appId,
  );
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (getApps().length > 0) return getApp();
  const config = readFirebaseConfig();
  return initializeApp({
    apiKey: config.apiKey ?? '',
    authDomain: config.authDomain ?? '',
    projectId: config.projectId ?? '',
    appId: config.appId ?? '',
    ...(config.storageBucket ? { storageBucket: config.storageBucket } : {}),
    ...(config.messagingSenderId
      ? { messagingSenderId: config.messagingSenderId }
      : {}),
  });
}
