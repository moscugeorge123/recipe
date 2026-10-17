import { updateProfile } from 'firebase/auth';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

import { syncAccountDoc } from '@/features/auth/account-doc';
import { getFirebaseAuth, getFirebaseStorage } from '@/features/auth/firebase';
import { useTortieAuth } from '@/tortie/auth-store';

/** Largest picture we upload. Storage rules enforce the same cap (see `storage.rules`). */
export const MAX_AVATAR_BYTES = 1024 * 1024;

function avatarPath(uid: string): string {
  return `users/${uid}/avatar.jpg`;
}

function currentUser() {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('signed-out');
  return user;
}

/** Profile edits do not fire the token listener, so push the user into the store by hand. */
function syncStore(): void {
  useTortieAuth.getState()._setFirebaseUser(getFirebaseAuth().currentUser);
}

/**
 * Uploads a picked image as the account's picture and makes it the Firebase
 * `photoURL`, replacing a provider photo. Nothing changes if any step fails, so
 * the previous picture stays.
 */
export async function uploadAvatar(localUri: string): Promise<string> {
  const user = currentUser();
  const blob = await (await fetch(localUri)).blob();
  if (blob.size > MAX_AVATAR_BYTES) throw new Error('too-large');
  const file = ref(getFirebaseStorage(), avatarPath(user.uid));
  await uploadBytes(file, blob, { contentType: 'image/jpeg' });
  // The download token is stable across overwrites; the version busts image caches.
  const url = `${await getDownloadURL(file)}&v=${Date.now()}`;
  await updateProfile(user, { photoURL: url });
  syncStore();
  await syncAccountDoc(user);
  return url;
}

/** Clears the picture and deletes the stored file. The avatar falls back to initials. */
export async function removeAvatar(): Promise<void> {
  const user = currentUser();
  await updateProfile(user, { photoURL: null });
  syncStore();
  await syncAccountDoc(user);
  await deleteStoredAvatar(user.uid);
}

/** Best effort: used on remove and before an account is deleted. A missing file is fine. */
export async function deleteStoredAvatar(uid: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), avatarPath(uid)));
  } catch {
    // Never uploaded, or already gone.
  }
}
