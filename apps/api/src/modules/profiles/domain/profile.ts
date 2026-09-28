import type { VerifiedIdentity } from '../../auth/domain/token.js';

export const DEFAULT_PROFILE_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_PROFILE_KEY = 'default';

export interface ResolvedProfile {
  userId: string;
  mode: 'implicit' | 'authenticated';
  firebaseUid?: string;
  role?: 'USER' | 'ADMIN';
  email?: string | null;
  emailVerified?: boolean;
  phoneNumber?: string | null;
  signInProvider?: string;
  authTime?: number;
}

export interface ProfileResolutionInput {
  requestId: string;
  authorization?: string;
  appCheckToken?: string;
}

/** Resolver result. `identity` is copied onto `request.auth` and is not part of the profile. */
export interface ProfileResolution extends ResolvedProfile {
  identity?: VerifiedIdentity;
  /** True when this resolution inserted the application user. */
  userCreated?: boolean;
}

/**
 * Request identity boundary. Authentication can replace this implementation without changing
 * controllers, request context, or persistence-facing services.
 */
export interface ProfileResolver {
  resolve(input: ProfileResolutionInput): Promise<ProfileResolution>;
}

export class ImplicitProfileResolver implements ProfileResolver {
  async resolve(): Promise<ResolvedProfile> {
    return { userId: DEFAULT_PROFILE_ID, mode: 'implicit' };
  }
}
