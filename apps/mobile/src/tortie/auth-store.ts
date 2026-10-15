import type { User } from 'firebase/auth';
import { create } from 'zustand';

export type AuthProv = 'google' | 'facebook' | 'email';
export type TortieUser = {
  name: string;
  email: string;
  prov: AuthProv;
  img: boolean;
  photoURL?: string | null;
};

type Linked = { google: boolean; facebook: boolean };

/** Pieces of a Firebase `User` the app reads. Keeps the mapping testable. */
export type FirebaseUserLike = Pick<
  User,
  'displayName' | 'email' | 'photoURL'
> & { providerData: readonly { providerId: string }[] };

/**
 * Account state for Profile and Sign in, derived from the Firebase user. The
 * Firebase SDK persists the session itself, so nothing is stored here.
 * `status` is `loading` until the first auth callback fires.
 */
type Auth = {
  status: 'loading' | 'signedOut' | 'signedIn';
  authed: boolean;
  user: TortieUser | null;
  linked: Linked;
  /** Internal: called by the auth listener and `authService`, not by screens. */
  _setFirebaseUser: (user: FirebaseUserLike | null) => void;
};

const NO_LINKS: Linked = { google: false, facebook: false };

function provOf(providerId: string | undefined): AuthProv {
  if (providerId === 'google.com') return 'google';
  if (providerId === 'facebook.com') return 'facebook';
  return 'email';
}

export function userFromFirebase(user: FirebaseUserLike): {
  user: TortieUser;
  linked: Linked;
} {
  const ids = user.providerData.map((p) => p.providerId);
  return {
    user: {
      name: user.displayName ?? '',
      email: user.email ?? '',
      prov: provOf(ids[0]),
      img: !!user.photoURL,
      photoURL: user.photoURL,
    },
    linked: {
      google: ids.includes('google.com'),
      facebook: ids.includes('facebook.com'),
    },
  };
}

export const useTortieAuth = create<Auth>()((set) => ({
  status: 'loading',
  authed: false,
  user: null,
  linked: NO_LINKS,
  _setFirebaseUser: (firebaseUser) =>
    set(
      firebaseUser
        ? {
            status: 'signedIn',
            authed: true,
            ...userFromFirebase(firebaseUser),
          }
        : {
            status: 'signedOut',
            authed: false,
            user: null,
            linked: NO_LINKS,
          },
    ),
}));

export const firstName = (u: TortieUser | null) =>
  (u?.name ?? '').split(' ')[0] || 'there';
