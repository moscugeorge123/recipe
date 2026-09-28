import type { FastifyInstance } from 'fastify';

import type { VerifiedIdentity } from '../../modules/auth/domain/token.js';
import type {
  ProfileResolution,
  ProfileResolver,
  ResolvedProfile,
} from '../../modules/profiles/domain/profile.js';

declare module 'fastify' {
  interface FastifyRequest {
    profile: ResolvedProfile;
    /** Verified Firebase identity. Null when the request has no bearer token. */
    auth: VerifiedIdentity | null;
    /** True when this request's resolver inserted the application user. */
    authUserCreated: boolean;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
}

function toProfile(resolved: ProfileResolution): ResolvedProfile {
  return {
    userId: resolved.userId,
    mode: resolved.mode,
    ...(resolved.firebaseUid !== undefined ? { firebaseUid: resolved.firebaseUid } : {}),
    ...(resolved.role !== undefined ? { role: resolved.role } : {}),
    ...(resolved.email !== undefined ? { email: resolved.email } : {}),
    ...(resolved.emailVerified !== undefined ? { emailVerified: resolved.emailVerified } : {}),
    ...(resolved.phoneNumber !== undefined ? { phoneNumber: resolved.phoneNumber } : {}),
    ...(resolved.signInProvider !== undefined ? { signInProvider: resolved.signInProvider } : {}),
    ...(resolved.authTime !== undefined ? { authTime: resolved.authTime } : {}),
  };
}

/**
 * Resolves the caller once and exposes it to every versioned controller.
 * A verified bearer token sets `request.auth` and an authenticated profile.
 * Health routes are registered outside this hook and stay public.
 */
export function registerProfileContext(app: FastifyInstance, resolver: ProfileResolver): void {
  app.decorateRequest('profile', null as unknown as ResolvedProfile);
  app.decorateRequest('auth', null);
  app.decorateRequest('authUserCreated', false);
  app.addHook('onRequest', async (request) => {
    const authorization = headerValue(request.headers.authorization);
    const appCheckToken = headerValue(request.headers['x-firebase-appcheck']);
    const resolved = await resolver.resolve({
      requestId: request.id,
      ...(authorization !== undefined ? { authorization } : {}),
      ...(appCheckToken !== undefined ? { appCheckToken } : {}),
    });
    request.profile = toProfile(resolved);
    request.auth = resolved.identity ?? null;
    request.authUserCreated = resolved.userCreated === true;
  });
}
