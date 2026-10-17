import {
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
  linkWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { syncAccountDoc } from '@/features/auth/account-doc';
import { AuthError, authService } from '@/features/auth/auth-service';
import { getFacebookCredential } from '@/features/auth/providers/facebook';

jest.mock('@/features/auth/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));
jest.mock('@/features/auth/account-doc', () => ({
  syncAccountDoc: jest.fn(async () => undefined),
  deleteAccountDoc: jest.fn(async () => undefined),
}));
jest.mock('@/features/auth/providers/facebook', () => ({
  getFacebookCredential: jest.fn(),
  signOutOfFacebook: jest.fn(),
}));
jest.mock('@/features/auth/providers/google', () => ({
  getGoogleCredential: jest.fn(),
  signOutOfGoogle: jest.fn(),
}));

const facebookCredential = { providerId: 'facebook.com' };
const user = { email: 'Ana@Example.com' };

describe('authService account collisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(getFacebookCredential)
      .mockResolvedValue(facebookCredential as never);
  });

  test('a social sign-in on an email used elsewhere throws a collision', async () => {
    jest.mocked(signInWithCredential).mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'ana@example.com' },
    });
    jest.mocked(fetchSignInMethodsForEmail).mockResolvedValue(['google.com']);

    const failure = await authService.signInWithFacebook().then(
      () => null,
      (e: unknown) => (e instanceof AuthError ? e.failure : null),
    );

    expect(failure).toEqual({
      kind: 'collision',
      email: 'ana@example.com',
      existingProvider: 'google',
    });
  });

  test('assumes a password account when Firebase hides the sign-in methods', async () => {
    jest.mocked(signInWithCredential).mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'ana@example.com' },
    });
    jest.mocked(fetchSignInMethodsForEmail).mockResolvedValue([]);

    await expect(authService.signInWithFacebook()).rejects.toMatchObject({
      failure: { kind: 'collision', existingProvider: 'password' },
    });
  });

  test('links the stashed credential after the next successful sign-in', async () => {
    jest.mocked(signInWithCredential).mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'ana@example.com' },
    });
    jest.mocked(fetchSignInMethodsForEmail).mockResolvedValue([]);
    await expect(authService.signInWithFacebook()).rejects.toBeInstanceOf(
      AuthError,
    );

    jest
      .mocked(signInWithEmailAndPassword)
      .mockResolvedValue({ user } as never);
    jest.mocked(linkWithCredential).mockResolvedValue({} as never);
    jest.mocked(getAdditionalUserInfo).mockReturnValue(null);

    await expect(
      authService.signInWithEmail('ana@example.com', 'secret-pass'),
    ).resolves.toEqual({ isNewUser: false });
    expect(linkWithCredential).toHaveBeenCalledWith(user, facebookCredential);
    expect(syncAccountDoc).toHaveBeenCalledWith(user);

    // The stash is single-use.
    await authService.signInWithEmail('ana@example.com', 'secret-pass');
    expect(linkWithCredential).toHaveBeenCalledTimes(1);
  });

  test('other Firebase errors become user-facing messages', async () => {
    jest
      .mocked(signInWithEmailAndPassword)
      .mockRejectedValue({ code: 'auth/invalid-credential' });

    await expect(
      authService.signInWithEmail('ana@example.com', 'nope'),
    ).rejects.toMatchObject({
      failure: {
        kind: 'error',
        message: expect.stringContaining('doesn’t match'),
      },
    });
    expect(syncAccountDoc).not.toHaveBeenCalled();
  });
});
