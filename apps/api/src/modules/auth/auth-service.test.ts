import { AuthErrorCode } from '@recipe/contracts';
import { describe, expect, it } from 'vitest';

import { ForbiddenError } from '../../shared/errors/app-error.js';
import { AbuseGuard } from './application/abuse-guard.js';
import { AuthService } from './application/auth-service.js';
import { assertOwns } from './application/authorization.js';
import type { IdentityAdmin, VerifiedIdentity } from './domain/token.js';
import { MemoryAuthRepository } from './infrastructure/auth.repository.js';

function identity(uid: string, overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity {
  return {
    uid,
    email: `${uid}@example.com`,
    emailVerified: true,
    phoneNumber: null,
    authTime: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    signInProvider: 'password',
    providers: ['password'],
    ...overrides,
  };
}

function setup() {
  const repo = new MemoryAuthRepository();
  const deleted: string[] = [];
  const identityAdmin: IdentityAdmin = {
    async deleteUser(uid: string): Promise<void> {
      deleted.push(uid);
    },
    async getProviders(): Promise<string[] | null> {
      return null;
    },
  };
  const service = new AuthService(repo, identityAdmin, new AbuseGuard(), {
    reservedUsernames: [],
    phoneResendSeconds: 60,
    phoneMaxAttempts: 5,
  });
  return { repo, service, deleted };
}

describe('AuthService', () => {
  it('bootstraps once and updates the same uid on the second call', async () => {
    const { service } = setup();
    const first = await service.bootstrap(identity('uid-a'), { displayName: 'Ada' });
    const second = await service.bootstrap(identity('uid-a'), { displayName: 'Ada Lovelace' });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.uid).toBe('uid-a');
    expect(second.user.displayName).toBe('Ada Lovelace');
    expect(second.user.photoURL).toBeNull();
  });

  it('uses the verified identity uid when the input also carries a uid', async () => {
    const { service, repo } = setup();
    const sneaky = { displayName: 'Ada', uid: 'forged-uid' };
    const result = await service.bootstrap(identity('real-uid'), sneaky);

    expect(result.user.uid).toBe('real-uid');
    expect(result.user.id).not.toBe('real-uid');
    expect(await repo.findByFirebaseUid('forged-uid')).toBeNull();
  });

  it('refuses a second firebase uid that reuses an email and does not create a user', async () => {
    const { service, repo } = setup();
    await service.bootstrap(identity('uid-a', { email: 'shared@example.com' }));

    await expect(
      service.bootstrap(identity('uid-b', { email: 'Shared@Example.com' })),
    ).rejects.toMatchObject({ code: AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE });

    expect(await repo.findByFirebaseUid('uid-b')).toBeNull();
    expect((await repo.findByEmail('shared@example.com'))?.firebaseUid).toBe('uid-a');
  });

  it('lets exactly one of two concurrent username claims succeed', async () => {
    const { service, repo } = setup();
    await service.bootstrap(identity('uid-a'));
    await service.bootstrap(identity('uid-b'));
    repo.beforeClaimWrite = () => new Promise((resolve) => setTimeout(resolve, 20));

    const results = await Promise.allSettled([
      service.claimUsername('chef', 'uid-a'),
      service.claimUsername('chef', 'uid-b'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: expect.objectContaining({ code: AuthErrorCode.AUTH_USERNAME_TAKEN }),
    });
  });

  it('refuses a username that is already claimed', async () => {
    const { service } = setup();
    await service.bootstrap(identity('uid-a'));
    await service.bootstrap(identity('uid-b'));
    await service.claimUsername('taken_name', 'uid-a');

    await expect(service.claimUsername('taken_name', 'uid-b')).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_USERNAME_TAKEN,
    });
  });

  it('deletes an account idempotently when sign-in is recent', async () => {
    const { service, repo, deleted } = setup();
    const current = identity('uid-del');
    await service.bootstrap(current);

    await expect(service.deleteAccount(current)).resolves.toEqual({ deleted: true });
    expect(await repo.findByFirebaseUid('uid-del')).toBeNull();
    await expect(service.deleteAccount(current)).resolves.toEqual({ deleted: true });
    expect(deleted).toEqual(['uid-del', 'uid-del']);
  });

  it('refuses account deletion without a recent sign-in', async () => {
    const { service, repo } = setup();
    const current = identity('uid-stale');
    await service.bootstrap(current);
    const stale = identity('uid-stale', { authTime: Math.floor(Date.now() / 1000) - 3600 });

    await expect(service.deleteAccount(stale)).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_REQUIRES_RECENT_LOGIN,
    });
    expect(await repo.findByFirebaseUid('uid-stale')).not.toBeNull();
  });

  it('rejects an invalid phone number and a second challenge inside the cooldown', async () => {
    const { service } = setup();
    const current = identity('uid-phone');
    await service.bootstrap(current);

    await expect(service.phoneChallenge(current, '12345')).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_PHONE_INVALID,
    });
    await expect(service.phoneChallenge(current, '+14155550123')).resolves.toEqual({
      phoneNumber: '+14155550123',
      cooldownSeconds: 60,
    });
    await expect(service.phoneChallenge(current, '+14155550123')).rejects.toMatchObject({
      code: AuthErrorCode.AUTH_TOO_MANY_REQUESTS,
    });
  });

  it('accepts a password reset for an unknown email', async () => {
    const { service } = setup();
    await expect(service.requestPasswordReset('nobody@example.com')).resolves.toEqual({
      accepted: true,
    });
  });

  it('rejects a forged owner id', () => {
    expect(() => assertOwns('owner-a', 'owner-a')).not.toThrow();
    expect(() => assertOwns('owner-a', 'owner-b')).toThrow(ForbiddenError);
  });
});
