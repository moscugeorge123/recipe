import type {
  TokenVerifier,
  VerifiedIdentity,
} from '../../../infrastructure/auth/token-verifier.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import type {
  ProfileResolutionInput,
  ProfileResolver,
  ResolvedProfile,
} from '../domain/profile.js';
import type { IUserRepository } from '../repository/user.repository.js';

export interface FirebaseProfileResolverOptions {
  /** How long a verified uid keeps resolving without a database round trip. */
  cacheTtlMs?: number;
  /** Upper bound on cached accounts; the oldest entries are dropped first. */
  cacheMaxEntries?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface CacheEntry {
  userId: string;
  /** What the user row was last synced with. A token that differs triggers a refresh. */
  email: string | undefined;
  name: string | undefined;
  expiresAt: number;
}

const BEARER = /^Bearer\s+(\S+)$/i;
const DEFAULT_CACHE_TTL_MS = 10 * 60_000;
const DEFAULT_CACHE_MAX_ENTRIES = 5_000;

/**
 * Resolves the caller from a Firebase ID token: `Authorization: Bearer <token>` is verified, then
 * mapped to the `users` row owning that account (created on first sign-in).
 *
 * Verification stays on every request; only the uid -> user id lookup is cached, so a revoked or
 * expired token is still rejected immediately.
 */
export class FirebaseProfileResolver implements ProfileResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly verifier: TokenVerifier,
    private readonly users: IUserRepository,
    options: FirebaseProfileResolverOptions = {},
  ) {
    this.ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxEntries = options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  async resolve(input: ProfileResolutionInput): Promise<ResolvedProfile> {
    const token = BEARER.exec(input.authorization?.trim() ?? '')?.[1];
    if (token === undefined) {
      throw new UnauthorizedError({ message: 'A Bearer authentication token is required' });
    }

    const identity = await this.verifier.verify(token);

    return {
      userId: await this.userIdFor(identity),
      mode: 'authenticated',
      authSubject: identity.uid,
    };
  }

  forget(authSubject: string): void {
    this.cache.delete(authSubject);
  }

  private async userIdFor(identity: VerifiedIdentity): Promise<string> {
    const now = this.now();
    const cached = this.cache.get(identity.uid);
    if (
      cached !== undefined &&
      cached.expiresAt > now &&
      cached.email === identity.email &&
      cached.name === identity.name
    ) {
      return cached.userId;
    }

    const user = await this.users.findOrCreateByAuthSubject({
      authSubject: identity.uid,
      ...(identity.email !== undefined ? { email: identity.email } : {}),
      ...(identity.name !== undefined ? { displayName: identity.name } : {}),
    });

    this.remember(identity, user.id, now);
    return user.id;
  }

  private remember(identity: VerifiedIdentity, userId: string, now: number): void {
    // Re-inserting moves the key to the end, so Map iteration order is least recently stored.
    this.cache.delete(identity.uid);
    this.cache.set(identity.uid, {
      userId,
      email: identity.email,
      name: identity.name,
      expiresAt: now + this.ttlMs,
    });

    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) {
        break;
      }
      this.cache.delete(oldest.value);
    }
  }
}
