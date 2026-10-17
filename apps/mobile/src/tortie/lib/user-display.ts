import type { TortieUser } from '@/tortie/auth-store';

export const PROV_NAME = { google: 'Google', facebook: 'Facebook' } as const;

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/** Display name; OAuth sign-ins have no name until the API supports accounts. */
export function nameOf(u: TortieUser | null): string {
  if (!u) return '';
  if (u.name) return u.name;
  return u.prov === 'email' ? u.email : `${PROV_NAME[u.prov]} account`;
}

export type AvatarSource =
  | { kind: 'photo'; uri: string; initials: string }
  | { kind: 'initials'; initials: string };

/**
 * What an avatar shows. `photoURL` is the picture the user chose, or the
 * provider's photo until they choose one, so the order is picture, then
 * initials. A non-https value is ignored.
 */
export function avatarSource(u: TortieUser | null): AvatarSource {
  const initials = initialsOf(nameOf(u));
  const uri = u?.photoURL;
  return uri && /^https:\/\//.test(uri)
    ? { kind: 'photo', uri, initials }
    : { kind: 'initials', initials };
}
