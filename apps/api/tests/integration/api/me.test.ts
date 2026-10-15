import { DEFAULT_CATEGORIES } from '@recipe/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  fakeBearer,
  FakeAccountDeleter,
} from '../../../src/infrastructure/auth/fake-token-verifier.js';
import { buildTestApp, createFakeAuthContainer } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('/me with Firebase-style authentication', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;
  let deleter: FakeAccountDeleter;

  const me = (authorization: string) =>
    app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization } });

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    await resetDatabase(prisma);
    deleter = new FakeAccountDeleter();
    app = await buildTestApp({ container: createFakeAuthContainer(deleter) });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  it('rejects requests without a token using the standard 401 envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a garbage token on resource routes, but keeps /health public', async () => {
    const categories = await app.inject({
      method: 'GET',
      url: '/api/v1/categories',
      headers: { authorization: 'Bearer garbage' },
    });
    const health = await app.inject({ method: 'GET', url: '/health' });

    expect(categories.statusCode).toBe(401);
    expect(health.statusCode).toBe(200);
  });

  it('creates the user and its default categories on first sign-in', async () => {
    const response = await me(fakeBearer('uid-1', 'ada@example.com', 'Ada'));

    expect(response.statusCode).toBe(200);
    const account = response.json().data;
    expect(account).toMatchObject({ email: 'ada@example.com', displayName: 'Ada' });

    const categories = await prisma.category.findMany({ where: { userId: account.id as string } });
    expect(categories.map((c) => c.slug).sort()).toEqual(
      DEFAULT_CATEGORIES.map((c) => c.slug).sort(),
    );
  });

  it('reuses one user for repeated and concurrent first requests', async () => {
    const authorization = fakeBearer('uid-1', 'ada@example.com');

    await Promise.all(Array.from({ length: 5 }, () => me(authorization)));

    const users = await prisma.user.findMany({ where: { authSubject: 'uid-1' } });
    expect(users).toHaveLength(1);
    expect(await prisma.category.count({ where: { userId: users[0]?.id ?? '' } })).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it('keeps accounts separate', async () => {
    const a = await me(fakeBearer('uid-a', 'a@example.com'));
    const b = await me(fakeBearer('uid-b', 'b@example.com'));

    expect(a.json().data.id).not.toBe(b.json().data.id);
  });

  it('still signs in when the email already belongs to another account', async () => {
    await me(fakeBearer('uid-a', 'same@example.com'));

    const second = await me(fakeBearer('uid-b', 'same@example.com'));

    expect(second.statusCode).toBe(200);
    expect(second.json().data.email).toBeNull();
  });

  it('DELETE /me removes the user and everything it owns, then the Firebase user', async () => {
    const authorization = fakeBearer('uid-1', 'ada@example.com');
    const userId = (await me(authorization)).json().data.id as string;
    const otherId = (await me(fakeBearer('uid-2', 'other@example.com'))).json().data.id as string;

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me',
      headers: { authorization },
    });

    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ data: { deleted: true } });
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.category.count({ where: { userId } })).toBe(0);
    expect(deleter.deleted).toEqual(['uid-1']);
    expect(await prisma.user.findUnique({ where: { id: otherId } })).not.toBeNull();
  });

  it('forgets the deleted account so the next sign-in starts a fresh one', async () => {
    const authorization = fakeBearer('uid-1', 'ada@example.com');
    const first = await me(authorization);
    await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: { authorization } });

    const again = await me(authorization);

    expect(again.statusCode).toBe(200);
    expect(again.json().data.id).not.toBe(first.json().data.id);
  });
});
