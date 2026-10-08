import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthProv = 'google' | 'facebook' | 'email';
export type TortieUser = {
  name: string;
  email: string;
  prov: AuthProv;
  img: boolean;
};

/**
 * Account state for Profile and Sign in. The API has no authentication yet,
 * so signing in only records the entered identity on this device.
 */
type Auth = {
  authed: boolean;
  user: TortieUser | null;
  linked: { google: boolean; facebook: boolean };
  signIn: (u: TortieUser) => void;
  signOut: () => void;
  link: (k: 'google' | 'facebook') => void;
};

export const useTortieAuth = create<Auth>()(
  persist(
    (set) => ({
      authed: false,
      user: null,
      linked: { google: false, facebook: false },
      signIn: (user) =>
        set({
          authed: true,
          user,
          linked: {
            google: user.prov === 'google',
            facebook: user.prov === 'facebook',
          },
        }),
      signOut: () =>
        set({
          authed: false,
          user: null,
          linked: { google: false, facebook: false },
        }),
      link: (k) => set((s) => ({ linked: { ...s.linked, [k]: true } })),
    }),
    {
      name: 'tortie-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ authed, user, linked }) => ({ authed, user, linked }),
    },
  ),
);

export const firstName = (u: TortieUser | null) =>
  (u?.name ?? '').split(' ')[0] || 'there';
