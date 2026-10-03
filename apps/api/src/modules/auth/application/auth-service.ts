import {
  AuthErrorCode,
  AuthProviderId,
  authErrorMessage,
  canUnlinkProvider,
  isRecentAuth,
  normalizeEmail,
  validateEmail,
  validatePhoneE164,
  validateUsername,
  type ApplicationUser,
  type AuthAuditEvent,
} from '@recipe/contracts';

import { AuthAppError, ValidationError } from '../../../shared/errors/app-error.js';
import type { IdentityAdmin, VerifiedIdentity } from '../domain/token.js';
import type { AbuseGuard } from './abuse-guard.js';
import type {
  AuthRepository,
  StoredUser,
} from '../infrastructure/auth.repository.js';

const PHONE_WINDOW_MS = 10 * 60 * 1000;
const PASSWORD_RESET_LIMIT = 5;
const PASSWORD_RESET_WINDOW_MS = 60_000;

const RECENT_AUTH_EVENTS = new Set<AuthAuditEvent>([
  'PASSWORD_CHANGED',
  'EMAIL_CHANGED',
  'PHONE_CHANGED',
  'PROVIDER_UNLINKED',
  'ACCOUNT_DELETED',
]);

export interface AuthServiceOptions {
  reservedUsernames: readonly string[];
  phoneResendSeconds: number;
  phoneMaxAttempts: number;
}

export interface BootstrapInput {
  displayName?: string;
  username?: string;
  photoURL?: string;
}

export interface UpdateProfileInput {
  displayName?: string | null;
  photoURL?: string | null;
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;
}

export interface RecordEventInput {
  event: AuthAuditEvent;
  provider?: string;
  reason?: string;
}

function phoneIsVerified(identity: VerifiedIdentity): boolean {
  return identity.providers.includes(AuthProviderId.PHONE) || identity.phoneNumber !== null;
}

function toApplicationUser(user: StoredUser): ApplicationUser {
  return {
    id: user.id,
    uid: user.firebaseUid,
    username: user.username,
    usernameNormalized: user.usernameNormalized,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoUrl,
    phoneNumber: user.phoneNumber,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    providers: [...user.providers],
    onboardingCompleted: user.onboardingCompleted,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class AuthService {
  constructor(
    private readonly users: AuthRepository,
    private readonly identityAdmin: IdentityAdmin,
    private readonly abuse: AbuseGuard,
    private readonly options: AuthServiceOptions,
  ) {}

  async bootstrap(
    identity: VerifiedIdentity,
    input: BootstrapInput = {},
  ): Promise<{ user: ApplicationUser; created: boolean }> {
    const email = identity.email ? normalizeEmail(identity.email) : null;
    let user = await this.users.findByFirebaseUid(identity.uid);
    let created = false;

    if (!user && email) {
      const owner = await this.users.findByEmail(email);
      if (owner && owner.firebaseUid !== identity.uid) {
        throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
      }
    }

    if (!user) {
      user = await this.users.createFromIdentity({
        uid: identity.uid,
        email,
        emailVerified: identity.emailVerified,
        phoneNumber: identity.phoneNumber,
        phoneVerified: phoneIsVerified(identity),
        providers: identity.providers,
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.photoURL !== undefined ? { photoUrl: input.photoURL } : {}),
      });
      created = true;
    } else {
      user = await this.users.syncIdentity(user.id, {
        email,
        emailVerified: identity.emailVerified,
        phoneNumber: identity.phoneNumber,
        phoneVerified: phoneIsVerified(identity),
        providers: identity.providers,
        lastLoginAt: new Date(),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.photoURL !== undefined ? { photoUrl: input.photoURL } : {}),
      });
    }

    if (input.username !== undefined) {
      user = await this.claimStoredUsername(user, identity.uid, input.username);
    }

    await this.users.writeAudit({
      userId: user.id,
      firebaseUid: identity.uid,
      event: created ? 'USER_REGISTERED' : 'USER_LOGIN',
    });

    return { user: toApplicationUser(user), created };
  }

  async me(uid: string): Promise<ApplicationUser> {
    return toApplicationUser(await this.requireByUid(uid));
  }

  async updateProfile(uid: string, patch: UpdateProfileInput): Promise<ApplicationUser> {
    const user = await this.requireByUid(uid);
    if (patch.preferences !== undefined && !isPlainObject(patch.preferences)) {
      throw new ValidationError({ message: 'Preferences must be a JSON object' });
    }
    const updated = await this.users.updateProfile(user.id, {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.photoURL !== undefined ? { photoUrl: patch.photoURL } : {}),
      ...(patch.onboardingCompleted !== undefined
        ? { onboardingCompleted: patch.onboardingCompleted }
        : {}),
      ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
    });
    return toApplicationUser(updated);
  }

  async checkUsername(
    username: string,
    uid: string,
  ): Promise<{ available: boolean; username: string; usernameNormalized: string }> {
    const validated = this.parseUsername(username);
    const user = await this.users.findByFirebaseUid(uid);
    const taken = user
      ? await this.users.isUsernameTaken(validated.usernameNormalized, user.id)
      : await this.users.isUsernameTaken(validated.usernameNormalized);
    return {
      available: !taken,
      username: validated.username,
      usernameNormalized: validated.usernameNormalized,
    };
  }

  async claimUsername(username: string, uid: string): Promise<ApplicationUser> {
    const user = await this.requireByUid(uid);
    const updated = await this.claimStoredUsername(user, uid, username);
    return toApplicationUser(updated);
  }

  async recordEvent(identity: VerifiedIdentity, input: RecordEventInput): Promise<void> {
    if (RECENT_AUTH_EVENTS.has(input.event) && !isRecentAuth(identity.authTime)) {
      throw new AuthAppError(AuthErrorCode.AUTH_REQUIRES_RECENT_LOGIN);
    }

    const user = await this.users.findByFirebaseUid(identity.uid);

    if (input.event === 'PROVIDER_UNLINKED') {
      if (!user) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
      const provider = input.provider;
      if (!provider || !canUnlinkProvider(user.providers, provider)) {
        throw new AuthAppError(AuthErrorCode.AUTH_LAST_PROVIDER);
      }
      await this.users.syncIdentity(user.id, {
        providers: user.providers.filter((current) => current !== provider),
      });
    }

    await this.users.writeAudit({
      userId: user?.id ?? null,
      firebaseUid: identity.uid,
      event: input.event,
      ...((input.provider !== undefined || input.reason !== undefined)
        ? {
            metadata: {
              ...(input.provider !== undefined ? { provider: input.provider } : {}),
              ...(input.reason !== undefined ? { reason: input.reason } : {}),
            },
          }
        : {}),
    });
  }

  /**
   * Accepts a phone number for a client-side Firebase phone challenge.
   * Does not send SMS and does not store a verification code.
   */
  async phoneChallenge(
    identity: VerifiedIdentity,
    phoneNumber: string,
  ): Promise<{ phoneNumber: string; cooldownSeconds: number }> {
    const validated = validatePhoneE164(phoneNumber);
    if (!validated.ok || validated.e164 === undefined) {
      throw new AuthAppError(validated.ok ? AuthErrorCode.AUTH_PHONE_INVALID : validated.code, {
        message: validated.ok ? authErrorMessage(AuthErrorCode.AUTH_PHONE_INVALID) : validated.message,
      });
    }

    const owner = await this.users.findVerifiedPhone(validated.e164);
    if (owner && owner.firebaseUid !== identity.uid) {
      throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
    }

    const decision = this.abuse.hit({
      key: `phone:${identity.uid}`,
      limit: this.options.phoneMaxAttempts,
      windowMs: PHONE_WINDOW_MS,
      cooldownMs: this.options.phoneResendSeconds * 1000,
    });
    if (!decision.allowed) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOO_MANY_REQUESTS);
    }

    return {
      phoneNumber: validated.e164,
      cooldownSeconds: this.options.phoneResendSeconds,
    };
  }

  async requestPasswordReset(email: string): Promise<{ accepted: true }> {
    const validated = validateEmail(email);
    if (!validated.ok) {
      throw new AuthAppError(validated.code, { message: validated.message });
    }
    const normalized = normalizeEmail(email);
    const decision = this.abuse.hit({
      key: `password-reset:${normalized}`,
      limit: PASSWORD_RESET_LIMIT,
      windowMs: PASSWORD_RESET_WINDOW_MS,
    });
    if (!decision.allowed) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOO_MANY_REQUESTS);
    }

    const user = await this.users.findByEmail(normalized);
    if (user) {
      await this.users.writeAudit({
        userId: user.id,
        firebaseUid: user.firebaseUid,
        event: 'PASSWORD_RESET_REQUESTED',
      });
    }

    return { accepted: true };
  }

  async deleteAccount(identity: VerifiedIdentity): Promise<{ deleted: true }> {
    if (!isRecentAuth(identity.authTime)) {
      throw new AuthAppError(AuthErrorCode.AUTH_REQUIRES_RECENT_LOGIN);
    }

    const user = await this.users.findByFirebaseUid(identity.uid);
    if (user) {
      await this.users.writeAudit({
        userId: user.id,
        firebaseUid: identity.uid,
        event: 'ACCOUNT_DELETED',
      });
    }

    // Remove the Firebase identity before the application row. A failed Admin
    // delete leaves the profile in place so the client can retry. deleteUser
    // is idempotent when the Firebase account is already gone.
    await this.identityAdmin.deleteUser(identity.uid);
    if (user) {
      await this.users.deleteUserCascade(user.id);
    }
    return { deleted: true };
  }

  private async requireByUid(uid: string): Promise<StoredUser> {
    const user = await this.users.findByFirebaseUid(uid);
    if (!user) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
    return user;
  }

  private parseUsername(username: string): { username: string; usernameNormalized: string } {
    const result = validateUsername(username, { extraReserved: this.options.reservedUsernames });
    if (!result.ok || result.username === undefined || result.usernameNormalized === undefined) {
      throw new AuthAppError(result.ok ? AuthErrorCode.AUTH_USERNAME_INVALID : result.code, {
        message: result.ok
          ? authErrorMessage(AuthErrorCode.AUTH_USERNAME_INVALID)
          : result.message,
      });
    }
    return { username: result.username, usernameNormalized: result.usernameNormalized };
  }

  private async claimStoredUsername(
    user: StoredUser,
    firebaseUid: string,
    username: string,
  ): Promise<StoredUser> {
    const validated = this.parseUsername(username);
    return this.users.claimUsername({
      userId: user.id,
      firebaseUid,
      username: validated.username,
      usernameNormalized: validated.usernameNormalized,
    });
  }
}
