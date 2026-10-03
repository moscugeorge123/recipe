import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema, standardErrorResponses } from '../../../shared/errors/error-response.js';
import { dataResponseSchema } from '../../../shared/http/response.js';
import type { AuthService } from '../application/auth-service.js';
import { createAuthController } from './auth.controller.js';
import {
  applicationUserSchema,
  authEventBodySchema,
  bootstrapBodySchema,
  bootstrapResponseSchema,
  deleteAccountBodySchema,
  deletedResponseSchema,
  passwordResetBodySchema,
  passwordResetResponseSchema,
  phoneChallengeBodySchema,
  phoneChallengeResponseSchema,
  recordedResponseSchema,
  updateProfileBodySchema,
  usernameBodySchema,
  usernameCheckResponseSchema,
} from './auth.schema.js';

export interface AuthRoutesOptions {
  authService: AuthService;
}

const authErrors = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  ...standardErrorResponses,
} as const;

function perMinute(max: number): { max: number; timeWindow: number } {
  return { max, timeWindow: 60_000 };
}

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, opts) => {
  const controller = createAuthController(opts.authService);

  app.post(
    '/auth/bootstrap',
    {
      config: { rateLimit: perMinute(30) },
      schema: {
        tags: ['auth'],
        summary: 'Create or update the application user from the verified Firebase identity',
        body: bootstrapBodySchema,
        response: {
          200: dataResponseSchema(bootstrapResponseSchema),
          ...authErrors,
        },
      },
    },
    controller.bootstrap,
  );

  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Return the application user for the verified token',
        response: {
          200: dataResponseSchema(applicationUserSchema),
          ...authErrors,
        },
      },
    },
    controller.me,
  );

  app.patch(
    '/auth/profile',
    {
      schema: {
        tags: ['auth'],
        summary: 'Update display name, photo, onboarding, or preferences',
        body: updateProfileBodySchema,
        response: {
          200: dataResponseSchema(applicationUserSchema),
          ...authErrors,
        },
      },
    },
    controller.updateProfile,
  );

  app.post(
    '/auth/username/check',
    {
      config: { rateLimit: perMinute(30) },
      schema: {
        tags: ['auth'],
        summary: 'Check whether a username is available',
        body: usernameBodySchema,
        response: {
          200: dataResponseSchema(usernameCheckResponseSchema),
          ...authErrors,
        },
      },
    },
    controller.checkUsername,
  );

  app.post(
    '/auth/username/claim',
    {
      config: { rateLimit: perMinute(10) },
      schema: {
        tags: ['auth'],
        summary: 'Claim a username for the verified user',
        body: usernameBodySchema,
        response: {
          200: dataResponseSchema(applicationUserSchema),
          ...authErrors,
        },
      },
    },
    controller.claimUsername,
  );

  app.post(
    '/auth/account/delete',
    {
      config: { rateLimit: perMinute(5) },
      schema: {
        tags: ['auth'],
        summary: 'Delete the application user and the Firebase account',
        body: deleteAccountBodySchema,
        response: {
          200: dataResponseSchema(deletedResponseSchema),
          ...authErrors,
        },
      },
    },
    controller.deleteAccount,
  );

  app.post(
    '/auth/events',
    {
      config: { rateLimit: perMinute(30) },
      schema: {
        tags: ['auth'],
        summary: 'Record an authentication audit event',
        body: authEventBodySchema,
        response: {
          200: dataResponseSchema(recordedResponseSchema),
          ...authErrors,
        },
      },
    },
    controller.recordEvent,
  );

  app.post(
    '/auth/phone/challenge',
    {
      config: { rateLimit: perMinute(5) },
      schema: {
        tags: ['auth'],
        summary: 'Accept a phone number for client-side verification',
        description:
          'Rate limited. Does not send SMS and does not store a verification code. The client completes the challenge with Firebase.',
        body: phoneChallengeBodySchema,
        response: {
          200: dataResponseSchema(phoneChallengeResponseSchema),
          ...authErrors,
        },
      },
    },
    controller.phoneChallenge,
  );

  app.post(
    '/auth/password-reset',
    {
      config: { rateLimit: perMinute(5) },
      schema: {
        tags: ['auth'],
        summary: 'Request a password reset without revealing whether the email exists',
        body: passwordResetBodySchema,
        response: {
          200: dataResponseSchema(passwordResetResponseSchema),
          ...authErrors,
        },
      },
    },
    controller.requestPasswordReset,
  );
};
