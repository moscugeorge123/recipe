import type { App } from 'firebase-admin/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();
const deleteUser = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken, deleteUser }),
}));

const { FirebaseAccountDeleter, FirebaseTokenVerifier } =
  await import('../../../../src/infrastructure/auth/firebase-token-verifier.js');
const { UnauthorizedError } = await import('../../../../src/shared/errors/app-error.js');

const app = {} as App;

describe('FirebaseTokenVerifier', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    deleteUser.mockReset();
  });

  it('maps the decoded token to a provider-agnostic identity', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'u1',
      email: 'a@example.com',
      email_verified: true,
      name: 'Ada',
      picture: 'https://example.com/a.png',
      firebase: { sign_in_provider: 'google.com' },
    });

    await expect(new FirebaseTokenVerifier(app).verify('token')).resolves.toEqual({
      uid: 'u1',
      email: 'a@example.com',
      emailVerified: true,
      name: 'Ada',
      picture: 'https://example.com/a.png',
      signInProvider: 'google.com',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token', false);
  });

  it('omits fields the token does not carry', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', firebase: { sign_in_provider: 'password' } });

    const identity = await new FirebaseTokenVerifier(app).verify('token');

    expect(identity).toEqual({ uid: 'u1', emailVerified: false, signInProvider: 'password' });
  });

  it('passes the revocation setting to Firebase', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', firebase: { sign_in_provider: 'password' } });

    await new FirebaseTokenVerifier(app, { checkRevoked: true }).verify('token');

    expect(verifyIdToken).toHaveBeenCalledWith('token', true);
  });

  it('turns every verification failure into an UnauthorizedError without leaking the cause', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired: secret detail'));

    const failure = await new FirebaseTokenVerifier(app).verify('token').catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(UnauthorizedError);
    expect((failure as Error).message).not.toContain('secret detail');
  });
});

describe('FirebaseAccountDeleter', () => {
  beforeEach(() => {
    deleteUser.mockReset();
  });

  it('deletes the Firebase user', async () => {
    deleteUser.mockResolvedValue(undefined);

    await new FirebaseAccountDeleter(app).deleteUser('u1');

    expect(deleteUser).toHaveBeenCalledWith('u1');
  });

  it('treats an already-deleted user as success', async () => {
    deleteUser.mockRejectedValue(Object.assign(new Error('gone'), { code: 'auth/user-not-found' }));

    await expect(new FirebaseAccountDeleter(app).deleteUser('u1')).resolves.toBeUndefined();
  });

  it('propagates other failures', async () => {
    deleteUser.mockRejectedValue(new Error('network'));

    await expect(new FirebaseAccountDeleter(app).deleteUser('u1')).rejects.toThrow('network');
  });
});
