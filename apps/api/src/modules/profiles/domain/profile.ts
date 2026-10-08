export const DEFAULT_PROFILE_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_PROFILE_KEY = 'default';

export interface ResolvedProfile {
  userId: string;
  mode: 'implicit' | 'authenticated';
}

export interface ProfileResolutionInput {
  requestId: string;
  authorization?: string;
}

/**
 * Request identity boundary. Authentication can replace this implementation without changing
 * controllers, request context, or persistence-facing services.
 */
export interface ProfileResolver {
  resolve(input: ProfileResolutionInput): Promise<ResolvedProfile>;
}

export class ImplicitProfileResolver implements ProfileResolver {
  async resolve(): Promise<ResolvedProfile> {
    return { userId: DEFAULT_PROFILE_ID, mode: 'implicit' };
  }
}
