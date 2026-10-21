import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { getFirebaseConfig } from '@/constants/env';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  }
  return app;
}

/**
 * Lazy singleton. Persistence is AsyncStorage, so the session survives
 * restarts without a native Firebase module. Throws a clear error when the
 * `EXPO_PUBLIC_FIREBASE_*` variables are missing.
 */
export function getFirebaseAuth(): Auth {
  if (auth) {
    return auth;
  }
  const firebaseApp = getFirebaseApp();
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast refresh re-evaluates this module; the Auth instance already exists.
    auth = getAuth(firebaseApp);
  }
  return auth;
}

/** Lazy Firestore singleton for the same Firebase app (holds `users/{uid}` account docs). */
export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

/**
 * Lazy Cloud Storage singleton (profile pictures). The bucket is
 * `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` or the project default.
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    const bucket =
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      `${getFirebaseConfig().projectId}.firebasestorage.app`;
    storage = getStorage(getFirebaseApp(), `gs://${bucket}`);
  }
  return storage;
}
