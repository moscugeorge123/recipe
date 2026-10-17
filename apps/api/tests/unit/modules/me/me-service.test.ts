import { describe, expect, it, vi } from 'vitest';

import { FakeAccountDeleter } from '../../../../src/infrastructure/auth/fake-token-verifier.js';
import { silentLogger } from '../../../../src/infrastructure/logging/logger.js';
import { MeService } from '../../../../src/modules/me/application/me-service.js';
import type { ResolvedProfile } from '../../../../src/modules/profiles/domain/profile.js';
import type { IUserRepository } from '../../../../src/modules/profiles/repository/user.repository.js';
import { ForbiddenError, NotFoundError } from '../../../../src/shared/errors/app-error.js';

const authenticated: ResolvedProfile = {
  userId: 'user-1',
  mode: 'authenticated',
  authSubject: 'uid-1',
};

function createUsers(overrides: Partial<IUserRepository> = {}) {
  const deleteById = vi.fn().mockResolvedValue(true);
  const users: IUserRepository = {
    findOrCreateByAuthSubject: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: 'user-1',
      authSubject: 'uid-1',
      email: 'a@example.com',
      displayName: 'Ada',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    }),
    deleteById,
    ...overrides,
  };
  return Object.assign(users, { deleteByIdMock: deleteById });
}

describe('MeService', () => {
  it('returns the account in contract shape', async () => {
    const service = new MeService({
      users: createUsers(),
      accountDeleter: null,
      forgetAccount: vi.fn(),
      log: silentLogger(),
    });

    await expect(service.get('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'a@example.com',
      displayName: 'Ada',
      createdAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('reports a missing account as 404', async () => {
    const service = new MeService({
      users: createUsers({ findById: vi.fn().mockResolvedValue(null) }),
      accountDeleter: null,
      forgetAccount: vi.fn(),
      log: silentLogger(),
    });

    await expect(service.get('user-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes the user, forgets the cached identity and removes the Firebase user', async () => {
    const users = createUsers();
    const forgetAccount = vi.fn();
    const accountDeleter = new FakeAccountDeleter();
    const service = new MeService({ users, accountDeleter, forgetAccount, log: silentLogger() });

    await service.delete(authenticated);

    expect(users.deleteByIdMock).toHaveBeenCalledWith('user-1');
    expect(forgetAccount).toHaveBeenCalledWith('uid-1');
    expect(accountDeleter.deleted).toEqual(['uid-1']);
  });

  it('skips the Firebase call when no service account is configured', async () => {
    const forgetAccount = vi.fn();
    const service = new MeService({
      users: createUsers(),
      accountDeleter: null,
      forgetAccount,
      log: silentLogger(),
    });

    await expect(service.delete(authenticated)).resolves.toBeUndefined();
    expect(forgetAccount).toHaveBeenCalledWith('uid-1');
  });

  it('still succeeds when the Firebase deletion fails after the data is gone', async () => {
    const service = new MeService({
      users: createUsers(),
      accountDeleter: { deleteUser: vi.fn().mockRejectedValue(new Error('boom')) },
      forgetAccount: vi.fn(),
      log: silentLogger(),
    });

    await expect(service.delete(authenticated)).resolves.toBeUndefined();
  });

  it('refuses to delete the shared implicit profile', async () => {
    const users = createUsers();
    const service = new MeService({
      users,
      accountDeleter: null,
      forgetAccount: vi.fn(),
      log: silentLogger(),
    });

    await expect(service.delete({ userId: 'default', mode: 'implicit' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(users.deleteByIdMock).not.toHaveBeenCalled();
  });
});
