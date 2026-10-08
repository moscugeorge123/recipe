import type { FastifyInstance } from 'fastify';

import type { ProfileResolver, ResolvedProfile } from '../../modules/profiles/domain/profile.js';

declare module 'fastify' {
  interface FastifyRequest {
    profile: ResolvedProfile;
  }
}

/**
 * Resolves the caller once and exposes it to every versioned controller. Today the resolver
 * returns the singleton profile; a future auth resolver can consume the authorization header.
 */
export function registerProfileContext(app: FastifyInstance, resolver: ProfileResolver): void {
  app.decorateRequest('profile', null as unknown as ResolvedProfile);
  app.addHook('onRequest', async (request) => {
    const authorization = request.headers.authorization;
    request.profile = await resolver.resolve({
      requestId: request.id,
      ...(authorization !== undefined ? { authorization } : {}),
    });
  });
}
