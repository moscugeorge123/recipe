import { describe, expect, it } from 'vitest';

import {
  fakeIdToken,
  FakeTokenVerifier,
} from '../../../../src/infrastructure/auth/fake-token-verifier.js';
import { UnauthorizedError } from '../../../../src/shared/errors/app-error.js';

describe('FakeTokenVerifier', () => {
  const verifier = new FakeTokenVerifier();

  it('reads uid, email and name from the token text', async () => {
    await expect(verifier.verify(fakeIdToken('u1', 'a@example.com', 'Ada'))).resolves.toEqual({
      uid: 'u1',
      email: 'a@example.com',
      name: 'Ada',
      emailVerified: true,
      signInProvider: 'password',
    });
  });

  it('allows a token with only a uid', async () => {
    const identity = await verifier.verify(fakeIdToken('u1'));

    expect(identity.uid).toBe('u1');
    expect(identity.email).toBeUndefined();
    expect(identity.emailVerified).toBe(false);
  });

  it.each(['', 'garbage', 'test', 'test:', 'other:u1'])('rejects %j', async (token) => {
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
