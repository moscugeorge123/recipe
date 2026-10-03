import { AUTH_AUDIT_EVENTS } from '@recipe/contracts';
import { z } from 'zod';

export const applicationUserSchema = z.object({
  id: z.string(),
  uid: z.string(),
  username: z.string().nullable(),
  usernameNormalized: z.string().nullable(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  providers: z.array(z.string()),
  onboardingCompleted: z.boolean(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().nullable(),
});

export const bootstrapBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  username: z.string().min(1).max(40).optional(),
  photoURL: z.string().min(1).max(2048).optional(),
  /** Accepted and ignored. The Firebase UID comes from the verified token. */
  uid: z.string().optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
});

export const bootstrapResponseSchema = z.object({
  user: applicationUserSchema,
  created: z.boolean(),
});

export const updateProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    photoURL: z.string().min(1).max(2048).nullable().optional(),
    onboardingCompleted: z.boolean().optional(),
    preferences: z
      .custom<Record<string, unknown>>(
        (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
      )
      .optional(),
  })
  .strict();

export const usernameBodySchema = z
  .object({
    username: z.string().min(1).max(40),
  })
  .strict();

export const usernameCheckResponseSchema = z.object({
  available: z.boolean(),
  username: z.string(),
  usernameNormalized: z.string(),
});

export const deleteAccountBodySchema = z
  .object({
    confirmation: z.literal('DELETE'),
  })
  .strict();

export const deletedResponseSchema = z.object({
  deleted: z.literal(true),
});

export const authEventBodySchema = z
  .object({
    event: z.enum(AUTH_AUDIT_EVENTS),
    provider: z.string().min(1).max(64).optional(),
    reason: z.string().min(1).max(120).optional(),
  })
  .strict();

export const recordedResponseSchema = z.object({
  recorded: z.literal(true),
});

export const phoneChallengeBodySchema = z
  .object({
    phoneNumber: z.string().min(1).max(32),
  })
  .strict();

export const phoneChallengeResponseSchema = z.object({
  phoneNumber: z.string(),
  cooldownSeconds: z.number().int(),
});

export const passwordResetBodySchema = z
  .object({
    email: z.string().min(1).max(320),
  })
  .strict();

export const passwordResetResponseSchema = z.object({
  accepted: z.literal(true),
});

export type BootstrapBody = z.infer<typeof bootstrapBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type UsernameBody = z.infer<typeof usernameBodySchema>;
export type DeleteAccountBody = z.infer<typeof deleteAccountBodySchema>;
export type AuthEventBody = z.infer<typeof authEventBodySchema>;
export type PhoneChallengeBody = z.infer<typeof phoneChallengeBodySchema>;
export type PasswordResetBody = z.infer<typeof passwordResetBodySchema>;
