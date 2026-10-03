import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import { dataResponse } from '../../../shared/http/response.js';
import type { AuthService } from '../application/auth-service.js';
import type { VerifiedIdentity } from '../domain/token.js';
import type {
  AuthEventBody,
  BootstrapBody,
  DeleteAccountBody,
  PasswordResetBody,
  PhoneChallengeBody,
  UpdateProfileBody,
  UsernameBody,
} from './auth.schema.js';

function requireIdentity(request: FastifyRequest): VerifiedIdentity {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth;
}

export function createAuthController(service: AuthService) {
  return {
    bootstrap: async (
      request: FastifyRequest<{ Body: BootstrapBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      const body = request.body;
      const result = await service.bootstrap(identity, {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.username !== undefined ? { username: body.username } : {}),
        ...(body.photoURL !== undefined ? { photoURL: body.photoURL } : {}),
      });
      reply.send(
        dataResponse({
          user: result.user,
          created: result.created || request.authUserCreated,
        }),
      );
    },

    me: async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const identity = requireIdentity(request);
      reply.send(dataResponse(await service.me(identity.uid)));
    },

    updateProfile: async (
      request: FastifyRequest<{ Body: UpdateProfileBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      const body = request.body;
      const user = await service.updateProfile(identity.uid, {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.photoURL !== undefined ? { photoURL: body.photoURL } : {}),
        ...(body.onboardingCompleted !== undefined
          ? { onboardingCompleted: body.onboardingCompleted }
          : {}),
        ...(body.preferences !== undefined ? { preferences: body.preferences } : {}),
      });
      reply.send(dataResponse(user));
    },

    checkUsername: async (
      request: FastifyRequest<{ Body: UsernameBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      reply.send(dataResponse(await service.checkUsername(request.body.username, identity.uid)));
    },

    claimUsername: async (
      request: FastifyRequest<{ Body: UsernameBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      reply.send(dataResponse(await service.claimUsername(request.body.username, identity.uid)));
    },

    deleteAccount: async (
      request: FastifyRequest<{ Body: DeleteAccountBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      reply.send(dataResponse(await service.deleteAccount(identity)));
    },

    recordEvent: async (
      request: FastifyRequest<{ Body: AuthEventBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      const body = request.body;
      await service.recordEvent(identity, {
        event: body.event,
        ...(body.provider !== undefined ? { provider: body.provider } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      });
      reply.send(dataResponse({ recorded: true as const }));
    },

    phoneChallenge: async (
      request: FastifyRequest<{ Body: PhoneChallengeBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const identity = requireIdentity(request);
      reply.send(dataResponse(await service.phoneChallenge(identity, request.body.phoneNumber)));
    },

    requestPasswordReset: async (
      request: FastifyRequest<{ Body: PasswordResetBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      reply.send(dataResponse(await service.requestPasswordReset(request.body.email)));
    },
  };
}
