import type { MeResponse } from '@recipe/contracts';

import type { AccountDeleter } from '../../../infrastructure/auth/token-verifier.js';
import type { AppLogger } from '../../../infrastructure/logging/logger.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/app-error.js';
import type { ResolvedProfile } from '../../profiles/domain/profile.js';
import type { IUserRepository } from '../../profiles/repository/user.repository.js';

export interface MeServiceDependencies {
  users: IUserRepository;
  /** `null` when no service account is configured: the client then deletes the Firebase user. */
  accountDeleter: AccountDeleter | null;
  /** Drops cached identity for a deleted account (see `ProfileResolver.forget`). */
  forgetAccount: (authSubject: string) => void;
  log: AppLogger;
}

export class MeService {
  constructor(private readonly deps: MeServiceDependencies) {}

  async get(userId: string): Promise<MeResponse> {
    const user = await this.deps.users.findById(userId);
    if (!user) {
      throw new NotFoundError({ message: 'Account not found' });
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Deletes the account: every owned row goes with the user (cascading relations), then the
   * Firebase user when a service account is configured.
   */
  async delete(profile: ResolvedProfile): Promise<void> {
    // The implicit profile is the shared default user; deleting it would wipe everyone's data.
    if (profile.mode !== 'authenticated' || profile.authSubject === undefined) {
      throw new ForbiddenError({ message: 'Account deletion requires an authenticated account' });
    }

    const { authSubject } = profile;
    await this.deps.users.deleteById(profile.userId);
    this.deps.forgetAccount(authSubject);

    if (this.deps.accountDeleter === null) {
      this.deps.log.info(
        { userId: profile.userId },
        'Account data deleted; Firebase user left for the client to delete',
      );
      return;
    }

    try {
      await this.deps.accountDeleter.deleteUser(authSubject);
    } catch (error) {
      // The data is already gone and the client deletes the Firebase user itself, so failing the
      // request here would only leave the app stuck on a half-deleted account.
      this.deps.log.error(
        { err: error, userId: profile.userId },
        'Failed to delete the Firebase user after deleting account data',
      );
    }
  }
}
