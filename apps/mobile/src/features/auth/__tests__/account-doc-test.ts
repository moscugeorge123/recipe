import type { User } from 'firebase/auth';
import { deleteDoc, getDoc, setDoc } from 'firebase/firestore';

import { deleteAccountDoc, syncAccountDoc } from '@/features/auth/account-doc';

jest.mock('@/features/auth/firebase', () => ({
  getFirebaseDb: () => ({}),
}));

const user = {
  uid: 'uid-1',
  email: 'ana@example.com',
  displayName: 'Ana',
  photoURL: null,
  providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
} as unknown as User;

describe('account doc', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates users/{uid} with createdAt on first sign-in', async () => {
    jest.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);

    await syncAccountDoc(user);

    expect(setDoc).toHaveBeenCalledWith(
      { path: 'users/uid-1' },
      expect.objectContaining({
        uid: 'uid-1',
        email: 'ana@example.com',
        displayName: 'Ana',
        providers: ['password', 'google.com'],
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      }),
      { merge: true },
    );
  });

  test('keeps the original createdAt on later sign-ins', async () => {
    jest.mocked(getDoc).mockResolvedValue({ exists: () => true } as never);

    await syncAccountDoc(user);

    expect(jest.mocked(setDoc).mock.calls[0]?.[1]).not.toHaveProperty(
      'createdAt',
    );
  });

  test('never throws when Firestore fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(getDoc).mockRejectedValue(new Error('offline'));

    await expect(syncAccountDoc(user)).resolves.toBeUndefined();
    jest.mocked(deleteDoc).mockRejectedValueOnce(new Error('denied'));
    await expect(deleteAccountDoc('uid-1')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
