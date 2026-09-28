import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/app-error.js';
import type { ResolvedProfile } from '../../profiles/domain/profile.js';

export function requireUser(
  profile: ResolvedProfile,
): asserts profile is ResolvedProfile & { mode: 'authenticated' } {
  if (profile.mode !== 'authenticated') {
    throw new UnauthorizedError();
  }
}

export function requireAdmin(profile: ResolvedProfile): void {
  if (profile.mode !== 'authenticated' || profile.role !== 'ADMIN') {
    throw new ForbiddenError();
  }
}

/** Rejects a caller who is not the owner of the resource. */
export function assertOwns(ownerUserId: string, requestUserId: string): void {
  if (ownerUserId !== requestUserId) {
    throw new ForbiddenError();
  }
}
