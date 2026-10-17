import { updateProfile } from 'firebase/auth';
import { getDownloadURL, uploadBytes } from 'firebase/storage';

import { removeAvatar, uploadAvatar } from '@/features/auth/avatar-service';
import { avatarSource } from '@/tortie/lib/user-display';
import type { TortieUser } from '@/tortie/auth-store';

const user = { uid: 'u1', providerData: [] };

jest.mock('@/features/auth/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: user }),
  getFirebaseStorage: () => ({}),
}));
jest.mock('@/features/auth/account-doc', () => ({
  syncAccountDoc: jest.fn(async () => undefined),
}));

const base: TortieUser = {
  name: 'Ana Pop',
  email: 'a@b.c',
  prov: 'email',
  img: false,
  photoURL: null,
};

describe('avatarSource', () => {
  test('uses the photo when one is set', () => {
    expect(avatarSource({ ...base, photoURL: 'https://x/p.jpg' })).toEqual({
      kind: 'photo',
      uri: 'https://x/p.jpg',
      initials: 'AP',
    });
  });

  test('falls back to initials without a photo or with a non-https one', () => {
    expect(avatarSource(base)).toEqual({ kind: 'initials', initials: 'AP' });
    expect(avatarSource({ ...base, photoURL: 'file:///x.jpg' }).kind).toBe(
      'initials',
    );
    expect(avatarSource(null)).toEqual({ kind: 'initials', initials: '?' });
  });
});

describe('avatar upload', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('a failed upload keeps the previous photo', async () => {
    globalThis.fetch = jest.fn(async () => ({
      blob: async () => ({ size: 1000 }),
    })) as never;
    jest.mocked(uploadBytes).mockRejectedValue(new Error('offline'));

    await expect(uploadAvatar('file:///a.jpg')).rejects.toThrow('offline');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test('an oversized photo is rejected before upload', async () => {
    globalThis.fetch = jest.fn(async () => ({
      blob: async () => ({ size: 5 * 1024 * 1024 }),
    })) as never;

    await expect(uploadAvatar('file:///big.jpg')).rejects.toThrow('too-large');
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  test('success stores the download url as photoURL', async () => {
    globalThis.fetch = jest.fn(async () => ({
      blob: async () => ({ size: 1000 }),
    })) as never;
    jest.mocked(uploadBytes).mockResolvedValue({} as never);
    jest
      .mocked(getDownloadURL)
      .mockResolvedValue('https://x/avatar?alt=media&token=t');

    const url = await uploadAvatar('file:///a.jpg');
    expect(url).toContain('https://x/avatar?alt=media&token=t&v=');
    expect(updateProfile).toHaveBeenCalledWith(user, { photoURL: url });
  });

  test('remove clears photoURL', async () => {
    await removeAvatar();
    expect(updateProfile).toHaveBeenCalledWith(user, { photoURL: null });
  });
});
