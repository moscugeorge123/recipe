import {
  firstName,
  useTortieAuth,
  userFromFirebase,
} from '@/tortie/auth-store';

describe('userFromFirebase', () => {
  test('maps a password account', () => {
    const { user, linked } = userFromFirebase({
      displayName: 'Elena Moretti',
      email: 'elena@example.com',
      photoURL: null,
      providerData: [{ providerId: 'password' }],
    });
    expect(user).toMatchObject({
      name: 'Elena Moretti',
      email: 'elena@example.com',
      prov: 'email',
      img: false,
    });
    expect(linked).toEqual({ google: false, facebook: false });
  });

  test('reads the first provider and every linked one', () => {
    const { user, linked } = userFromFirebase({
      displayName: null,
      email: null,
      photoURL: 'https://example.com/a.png',
      providerData: [
        { providerId: 'google.com' },
        { providerId: 'facebook.com' },
      ],
    });
    expect(user).toMatchObject({
      name: '',
      email: '',
      prov: 'google',
      img: true,
    });
    expect(linked).toEqual({ google: true, facebook: true });
  });
});

describe('useTortieAuth', () => {
  test('starts loading, then follows the Firebase user', () => {
    expect(useTortieAuth.getState().status).toBe('loading');

    useTortieAuth.getState()._setFirebaseUser({
      displayName: 'Sam Cook',
      email: 'sam@example.com',
      photoURL: null,
      providerData: [{ providerId: 'password' }],
    });
    expect(useTortieAuth.getState()).toMatchObject({
      status: 'signedIn',
      authed: true,
    });
    expect(firstName(useTortieAuth.getState().user)).toBe('Sam');

    useTortieAuth.getState()._setFirebaseUser(null);
    expect(useTortieAuth.getState()).toMatchObject({
      status: 'signedOut',
      authed: false,
      user: null,
    });
  });
});
