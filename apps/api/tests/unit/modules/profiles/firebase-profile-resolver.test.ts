import { describe, expect, it, vi } from 'vitest';

import {
  fakeBearer,
  FakeTokenVerifier,
} from '../../../../src/infrastructure/auth/fake-token-verifier.js';
import { FirebaseProfileResolver } from '../../../../src/modules/profiles/application/firebase-profile-resolver.js';
import type {
  IUserRepository,
  UserIdentityInput,
  UserRecord,
} from '../../../../src/modules/profiles/repository/user.repository.js';
import { UnauthorizedError } from '../../../../src/shared/errors/app-error.js';

function createUsers() {
  const findOrCreate = vi.fn((identity: UserIdentityInput): Promise<UserRecord> => {
    return Promise.resolve({
      id: `user-of-${identity.authSubject}`,
      authSubject: identity.authSubject,
      email: identity.email ?? null,
      displayName: identity.displayName ?? null,
      createdAt: new Date(0),
    });
  });
  const users: IUserRepository = {
    findOrCreateByAuthSubject: findOrCreate,
    findById: vi.fn(),
    deleteById: vi.fn(),
  };
  return { users, findOrCreate };
}

describe('FirebaseProfileResolver', () => {
  it('rejects a request without an Authorization header', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);

    await expect(resolver.resolve({ requestId: 'r1' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(findOrCreate).not.toHaveBeenCalled();
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'test:abc', 'Bearer two tokens'])(
    'rejects a malformed header %j',
    async (authorization) => {
      const { users } = createUsers();
      const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);

      await expect(resolver.resolve({ requestId: 'r1', authorization })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    },
  );

  it('rejects a token the verifier does not accept without touching the database', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);

    await expect(
      resolver.resolve({ requestId: 'r1', authorization: 'Bearer garbage' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(findOrCreate).not.toHaveBeenCalled();
  });

  it('maps a verified uid to its user and exposes the uid', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);

    const profile = await resolver.resolve({
      requestId: 'r1',
      authorization: fakeBearer('uid-1', 'a@example.com', 'Ada'),
    });

    expect(profile).toEqual({
      userId: 'user-of-uid-1',
      mode: 'authenticated',
      authSubject: 'uid-1',
    });
    expect(findOrCreate).toHaveBeenCalledWith({
      authSubject: 'uid-1',
      email: 'a@example.com',
      displayName: 'Ada',
    });
  });

  it('accepts the Bearer scheme case-insensitively', async () => {
    const { users } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);

    const profile = await resolver.resolve({
      requestId: 'r1',
      authorization: fakeBearer('uid-1').replace('Bearer', 'bearer'),
    });

    expect(profile.userId).toBe('user-of-uid-1');
  });

  it('serves repeat requests from the cache without a database round trip', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);
    const authorization = fakeBearer('uid-1', 'a@example.com');

    await resolver.resolve({ requestId: 'r1', authorization });
    const second = await resolver.resolve({ requestId: 'r2', authorization });

    expect(second.userId).toBe('user-of-uid-1');
    expect(findOrCreate).toHaveBeenCalledTimes(1);
  });

  it('verifies the token on every request, even on a cache hit', async () => {
    const { users } = createUsers();
    const verifier = new FakeTokenVerifier();
    const verify = vi.spyOn(verifier, 'verify');
    const resolver = new FirebaseProfileResolver(verifier, users);
    const authorization = fakeBearer('uid-1');

    await resolver.resolve({ requestId: 'r1', authorization });
    await resolver.resolve({ requestId: 'r2', authorization });

    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('goes back to the database once the entry expires', async () => {
    const { users, findOrCreate } = createUsers();
    let now = 1_000;
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users, {
      cacheTtlMs: 500,
      now: () => now,
    });
    const authorization = fakeBearer('uid-1');

    await resolver.resolve({ requestId: 'r1', authorization });
    now += 499;
    await resolver.resolve({ requestId: 'r2', authorization });
    expect(findOrCreate).toHaveBeenCalledTimes(1);

    now += 2;
    await resolver.resolve({ requestId: 'r3', authorization });
    expect(findOrCreate).toHaveBeenCalledTimes(2);
  });

  it('refreshes the user when the token carries a different name or email', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);

    // Email sign-up: the first token is issued before updateProfile sets the display name.
    await resolver.resolve({
      requestId: 'r1',
      authorization: fakeBearer('uid-1', 'a@example.com'),
    });
    await resolver.resolve({
      requestId: 'r2',
      authorization: fakeBearer('uid-1', 'a@example.com', 'Ada'),
    });

    expect(findOrCreate).toHaveBeenCalledTimes(2);
    expect(findOrCreate).toHaveBeenLastCalledWith({
      authSubject: 'uid-1',
      email: 'a@example.com',
      displayName: 'Ada',
    });
  });

  it('forget() drops the cached entry', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users);
    const authorization = fakeBearer('uid-1');

    await resolver.resolve({ requestId: 'r1', authorization });
    resolver.forget('uid-1');
    await resolver.resolve({ requestId: 'r2', authorization });

    expect(findOrCreate).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache bounded, evicting the oldest entries first', async () => {
    const { users, findOrCreate } = createUsers();
    const resolver = new FirebaseProfileResolver(new FakeTokenVerifier(), users, {
      cacheMaxEntries: 2,
    });

    for (const uid of ['a', 'b', 'c']) {
      await resolver.resolve({ requestId: uid, authorization: fakeBearer(uid) });
    }
    expect(findOrCreate).toHaveBeenCalledTimes(3);

    // b and c are still cached; a was evicted.
    await resolver.resolve({ requestId: 'b', authorization: fakeBearer('b') });
    await resolver.resolve({ requestId: 'c', authorization: fakeBearer('c') });
    expect(findOrCreate).toHaveBeenCalledTimes(3);

    await resolver.resolve({ requestId: 'a', authorization: fakeBearer('a') });
    expect(findOrCreate).toHaveBeenCalledTimes(4);
  });
});
