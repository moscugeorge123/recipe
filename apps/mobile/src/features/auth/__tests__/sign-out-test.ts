import { signOut as firebaseSignOut } from 'firebase/auth';

import { authService } from '@/features/auth/auth-service';
import { resetUserData } from '@/features/auth/reset-user-data';
import { useTortieAuth } from '@/tortie/auth-store';

jest.mock('@/features/auth/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));
jest.mock('@/features/auth/account-doc', () => ({
  syncAccountDoc: jest.fn(),
  deleteAccountDoc: jest.fn(),
}));
jest.mock('@/features/auth/providers/google', () => ({
  getGoogleCredential: jest.fn(),
  signOutOfGoogle: jest.fn(async () => undefined),
}));
jest.mock('@/features/auth/providers/facebook', () => ({
  getFacebookCredential: jest.fn(),
  signOutOfFacebook: jest.fn(),
}));
jest.mock('@/features/auth/reset-user-data', () => ({
  resetUserData: jest.fn(async () => undefined),
}));

describe('sign out', () => {
  beforeEach(() => {
    useTortieAuth.setState({
      status: 'signedIn',
      authed: true,
      signingOut: false,
      user: { name: 'Ana', email: 'a@b.c', prov: 'email', img: false },
    });
  });

  test('the sign-in screen is shown before the local data is wiped', async () => {
    let statusWhenWiped: string | null = null;
    jest.mocked(resetUserData).mockImplementation(async () => {
      statusWhenWiped = useTortieAuth.getState().status;
    });

    await authService.signOut();

    expect(statusWhenWiped).toBe('signedOut');
    expect(useTortieAuth.getState().user).toBeNull();
  });

  test('the signing-out state covers the wait for Firebase, then clears', async () => {
    let flagDuringFirebaseSignOut: boolean | null = null;
    jest.mocked(firebaseSignOut).mockImplementationOnce(async () => {
      flagDuringFirebaseSignOut = useTortieAuth.getState().signingOut;
    });

    await authService.signOut();

    expect(flagDuringFirebaseSignOut).toBe(true);
    expect(useTortieAuth.getState().signingOut).toBe(false);
  });
});
