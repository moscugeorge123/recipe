import type { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { getFirebaseDb } from '@/features/auth/firebase';

/** Firestore collection holding one account document per Firebase uid. */
export const ACCOUNTS_COLLECTION = 'users';

/** Shape of `users/{uid}`. Recipe data stays in the API; this is the account profile only. */
export type AccountDoc = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providers: string[];
  createdAt: unknown;
  updatedAt: unknown;
};

function accountRef(uid: string) {
  return doc(getFirebaseDb(), ACCOUNTS_COLLECTION, uid);
}

/**
 * Creates or refreshes the signed-in user's account document. `createdAt` is
 * written once. Best-effort: a Firestore failure never blocks signing in.
 */
export async function syncAccountDoc(user: User): Promise<void> {
  try {
    const ref = accountRef(user.uid);
    const exists = (await getDoc(ref)).exists();
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providers: user.providerData.map((p) => p.providerId),
        updatedAt: serverTimestamp(),
        ...(exists ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('[account-doc] sync failed', error);
  }
}

/** Removes the account document. Must run while the user is still signed in. */
export async function deleteAccountDoc(uid: string): Promise<void> {
  try {
    await deleteDoc(accountRef(uid));
  } catch (error) {
    console.warn('[account-doc] delete failed', error);
  }
}
