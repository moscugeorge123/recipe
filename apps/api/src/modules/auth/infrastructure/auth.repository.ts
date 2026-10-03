import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { AuthErrorCode, type AppRole, type AuthAuditEvent } from '@recipe/contracts';

import { AuthAppError } from '../../../shared/errors/app-error.js';

export interface StoredUser {
  id: string;
  firebaseUid: string;
  username: string | null;
  usernameNormalized: string | null;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  providers: string[];
  onboardingCompleted: boolean;
  role: AppRole;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface CreateIdentityInput {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneVerified: boolean;
  providers: string[];
  displayName?: string | null;
  photoUrl?: string | null;
}

export interface IdentitySyncPatch {
  email?: string | null;
  emailVerified?: boolean;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  providers?: string[];
  photoUrl?: string | null;
  displayName?: string | null;
  lastLoginAt?: Date;
}

export interface ProfilePatch {
  displayName?: string | null;
  photoUrl?: string | null;
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;
}

export interface UsernameClaim {
  userId: string;
  firebaseUid: string;
  username: string;
  usernameNormalized: string;
}

export interface AuditWrite {
  userId: string | null;
  firebaseUid: string | null;
  event: AuthAuditEvent;
  metadata?: { provider?: string; reason?: string };
}

export interface AuthRepository {
  findByFirebaseUid(uid: string): Promise<StoredUser | null>;
  findByEmail(email: string): Promise<StoredUser | null>;
  findByUsernameNormalized(usernameNormalized: string): Promise<StoredUser | null>;
  findVerifiedPhone(phoneNumber: string): Promise<StoredUser | null>;
  createFromIdentity(identity: CreateIdentityInput): Promise<StoredUser>;
  syncIdentity(userId: string, patch: IdentitySyncPatch): Promise<StoredUser>;
  claimUsername(input: UsernameClaim): Promise<StoredUser>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<StoredUser>;
  writeAudit(input: AuditWrite): Promise<void>;
  deleteUserCascade(userId: string): Promise<void>;
  isUsernameTaken(usernameNormalized: string, exceptUserId?: string): Promise<boolean>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readPreferences(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return { ...value };
  }
  return {};
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (kind === 'object' && value !== undefined) {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  const out: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isJsonValue(entry)) out[key] = entry;
  }
  return out;
}

function shortMeta(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return undefined;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) return undefined;
  if (trimmed.toLowerCase().includes('bearer ')) return undefined;
  return trimmed;
}

function auditMetadata(input: AuditWrite['metadata']): Prisma.InputJsonObject {
  const metadata: Record<string, string> = {};
  const provider = shortMeta(input?.provider);
  const reason = shortMeta(input?.reason);
  if (provider !== undefined) metadata.provider = provider;
  if (reason !== undefined) metadata.reason = reason;
  return metadata;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function rowToStored(row: User): StoredUser {
  return {
    id: row.id,
    firebaseUid: row.firebaseUid ?? '',
    username: row.username,
    usernameNormalized: row.usernameNormalized,
    email: row.email,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    phoneNumber: row.phoneNumber,
    emailVerified: row.emailVerified,
    phoneVerified: row.phoneVerified,
    providers: [...row.providers],
    onboardingCompleted: row.onboardingCompleted,
    role: row.role,
    preferences: readPreferences(row.preferences),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByFirebaseUid(uid: string): Promise<StoredUser | null> {
    const row = await this.db.user.findUnique({ where: { firebaseUid: uid } });
    return row ? rowToStored(row) : null;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const row = await this.db.user.findUnique({ where: { email: normalizeEmail(email) } });
    return row ? rowToStored(row) : null;
  }

  async findByUsernameNormalized(usernameNormalized: string): Promise<StoredUser | null> {
    const row = await this.db.user.findUnique({ where: { usernameNormalized } });
    return row ? rowToStored(row) : null;
  }

  async findVerifiedPhone(phoneNumber: string): Promise<StoredUser | null> {
    const row = await this.db.user.findFirst({
      where: { phoneNumber, phoneVerified: true },
    });
    return row ? rowToStored(row) : null;
  }

  async createFromIdentity(identity: CreateIdentityInput): Promise<StoredUser> {
    const email = identity.email ? normalizeEmail(identity.email) : null;
    try {
      return await this.db.$transaction(async (tx) => {
        const byUid = await tx.user.findUnique({ where: { firebaseUid: identity.uid } });
        if (byUid) return rowToStored(byUid);
        if (email) {
          const byEmail = await tx.user.findUnique({ where: { email } });
          if (byEmail && byEmail.firebaseUid !== identity.uid) {
            throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
          }
        }
        const created = await tx.user.create({
          data: {
            firebaseUid: identity.uid,
            authSubject: identity.uid,
            email,
            emailVerified: identity.emailVerified,
            phoneNumber: identity.phoneNumber,
            phoneVerified: identity.phoneVerified,
            providers: identity.providers,
            lastLoginAt: new Date(),
            ...(identity.displayName !== undefined ? { displayName: identity.displayName } : {}),
            ...(identity.photoUrl !== undefined ? { photoUrl: identity.photoUrl } : {}),
          },
        });
        return rowToStored(created);
      });
    } catch (error) {
      if (error instanceof AuthAppError) throw error;
      if (isUniqueViolation(error)) {
        const existing = await this.db.user.findUnique({ where: { firebaseUid: identity.uid } });
        if (existing) return rowToStored(existing);
        throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
      }
      throw error;
    }
  }

  async syncIdentity(userId: string, patch: IdentitySyncPatch): Promise<StoredUser> {
    const email = patch.email === undefined || patch.email === null ? patch.email : normalizeEmail(patch.email);
    if (typeof email === 'string') {
      const owner = await this.db.user.findUnique({ where: { email } });
      if (owner && owner.id !== userId) {
        throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
      }
    }
    try {
      const current = await this.db.user.findUnique({ where: { id: userId } });
      if (!current) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
      const updated = await this.db.user.update({
        where: { id: userId },
        data: {
          ...(current.firebaseUid ? { authSubject: current.firebaseUid } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(patch.emailVerified !== undefined ? { emailVerified: patch.emailVerified } : {}),
          ...(patch.phoneNumber !== undefined ? { phoneNumber: patch.phoneNumber } : {}),
          ...(patch.phoneVerified !== undefined ? { phoneVerified: patch.phoneVerified } : {}),
          ...(patch.providers !== undefined ? { providers: patch.providers } : {}),
          ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
          ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
          ...(patch.lastLoginAt !== undefined ? { lastLoginAt: patch.lastLoginAt } : {}),
        },
      });
      return rowToStored(updated);
    } catch (error) {
      if (error instanceof AuthAppError) throw error;
      if (isUniqueViolation(error)) {
        throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
      }
      throw error;
    }
  }

  async claimUsername(input: UsernameClaim): Promise<StoredUser> {
    try {
      return await this.db.$transaction(async (tx) => {
        const [byName, reservation] = await Promise.all([
          tx.user.findUnique({ where: { usernameNormalized: input.usernameNormalized } }),
          tx.usernameReservation.findUnique({ where: { usernameNormalized: input.usernameNormalized } }),
        ]);
        if (
          (byName && byName.id !== input.userId) ||
          (reservation && reservation.userId !== input.userId)
        ) {
          throw new AuthAppError(AuthErrorCode.AUTH_USERNAME_TAKEN);
        }

        const current = await tx.user.findUnique({ where: { id: input.userId } });
        if (!current) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);

        if (
          current.usernameNormalized === input.usernameNormalized &&
          reservation?.userId === input.userId
        ) {
          if (current.username === input.username && current.authSubject === input.firebaseUid) {
            return rowToStored(current);
          }
          const updated = await tx.user.update({
            where: { id: input.userId },
            data: { username: input.username, authSubject: input.firebaseUid },
          });
          return rowToStored(updated);
        }

        await tx.usernameReservation.deleteMany({ where: { userId: input.userId } });
        const updated = await tx.user.update({
          where: { id: input.userId },
          data: {
            username: input.username,
            usernameNormalized: input.usernameNormalized,
            authSubject: input.firebaseUid,
          },
        });
        await tx.usernameReservation.create({
          data: {
            usernameNormalized: input.usernameNormalized,
            firebaseUid: input.firebaseUid,
            userId: input.userId,
          },
        });
        return rowToStored(updated);
      });
    } catch (error) {
      if (error instanceof AuthAppError) throw error;
      if (isUniqueViolation(error)) {
        throw new AuthAppError(AuthErrorCode.AUTH_USERNAME_TAKEN);
      }
      throw error;
    }
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<StoredUser> {
    const current = await this.db.user.findUnique({ where: { id: userId } });
    if (!current) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(current.firebaseUid ? { authSubject: current.firebaseUid } : {}),
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
        ...(patch.onboardingCompleted !== undefined
          ? { onboardingCompleted: patch.onboardingCompleted }
          : {}),
        ...(patch.preferences !== undefined
          ? {
              preferences: toJsonObject({
                ...readPreferences(current.preferences),
                ...patch.preferences,
              }),
            }
          : {}),
      },
    });
    return rowToStored(updated);
  }

  async writeAudit(input: AuditWrite): Promise<void> {
    await this.db.authAudit.create({
      data: {
        userId: input.userId,
        firebaseUid: input.firebaseUid,
        event: input.event,
        metadata: auditMetadata(input.metadata),
      },
    });
  }

  async deleteUserCascade(userId: string): Promise<void> {
    try {
      await this.db.user.delete({ where: { id: userId } });
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }

  async isUsernameTaken(usernameNormalized: string, exceptUserId?: string): Promise<boolean> {
    const [user, reservation] = await Promise.all([
      this.db.user.findUnique({ where: { usernameNormalized } }),
      this.db.usernameReservation.findUnique({ where: { usernameNormalized } }),
    ]);
    if (user && user.id !== exceptUserId) return true;
    if (reservation && reservation.userId !== exceptUserId) return true;
    return false;
  }
}

interface MemoryAudit {
  userId: string | null;
  firebaseUid: string | null;
  event: AuthAuditEvent;
  metadata: { provider?: string; reason?: string };
}

/**
 * In-memory repository with the same username atomicity as Postgres.
 * Claims run on a promise queue so two concurrent claims cannot both succeed.
 */
export class MemoryAuthRepository implements AuthRepository {
  /** Runs while the claim lock is held, after the taken-check and before the write. */
  beforeClaimWrite: (() => Promise<void>) | null = null;

  private readonly users = new Map<string, StoredUser>();
  private readonly byUid = new Map<string, string>();
  private readonly byEmail = new Map<string, string>();
  private readonly byUsername = new Map<string, string>();
  private readonly verifiedPhones = new Map<string, string>();
  private readonly audits: MemoryAudit[] = [];
  private tail: Promise<void> = Promise.resolve();

  async findByFirebaseUid(uid: string): Promise<StoredUser | null> {
    const id = this.byUid.get(uid);
    return id ? this.clone(this.users.get(id)) : null;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const id = this.byEmail.get(normalizeEmail(email));
    return id ? this.clone(this.users.get(id)) : null;
  }

  async findByUsernameNormalized(usernameNormalized: string): Promise<StoredUser | null> {
    const id = this.byUsername.get(usernameNormalized);
    return id ? this.clone(this.users.get(id)) : null;
  }

  async findVerifiedPhone(phoneNumber: string): Promise<StoredUser | null> {
    const id = this.verifiedPhones.get(phoneNumber);
    return id ? this.clone(this.users.get(id)) : null;
  }

  async createFromIdentity(identity: CreateIdentityInput): Promise<StoredUser> {
    return this.exclusive(async () => {
      const existingId = this.byUid.get(identity.uid);
      if (existingId) {
        const existing = this.users.get(existingId);
        if (existing) return this.clone(existing)!;
      }
      const email = identity.email ? normalizeEmail(identity.email) : null;
      if (email) {
        const ownerId = this.byEmail.get(email);
        const owner = ownerId ? this.users.get(ownerId) : undefined;
        if (owner && owner.firebaseUid !== identity.uid) {
          throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
        }
      }
      const now = new Date();
      const user: StoredUser = {
        id: randomUUID(),
        firebaseUid: identity.uid,
        username: null,
        usernameNormalized: null,
        email,
        displayName: identity.displayName ?? null,
        photoUrl: identity.photoUrl ?? null,
        phoneNumber: identity.phoneNumber,
        emailVerified: identity.emailVerified,
        phoneVerified: identity.phoneVerified,
        providers: [...identity.providers],
        onboardingCompleted: false,
        role: 'USER',
        preferences: {},
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      this.insert(user);
      return this.clone(user)!;
    });
  }

  async syncIdentity(userId: string, patch: IdentitySyncPatch): Promise<StoredUser> {
    return this.exclusive(async () => {
      const current = this.users.get(userId);
      if (!current) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
      const email =
        patch.email === undefined || patch.email === null ? patch.email : normalizeEmail(patch.email);
      if (typeof email === 'string') {
        const ownerId = this.byEmail.get(email);
        if (ownerId && ownerId !== userId) {
          throw new AuthAppError(AuthErrorCode.AUTH_CREDENTIAL_ALREADY_IN_USE);
        }
      }
      this.detachIndexes(current);
      const next: StoredUser = {
        ...current,
        providers: patch.providers ? [...patch.providers] : [...current.providers],
        preferences: { ...current.preferences },
        updatedAt: new Date(),
        ...(email !== undefined ? { email } : {}),
        ...(patch.emailVerified !== undefined ? { emailVerified: patch.emailVerified } : {}),
        ...(patch.phoneNumber !== undefined ? { phoneNumber: patch.phoneNumber } : {}),
        ...(patch.phoneVerified !== undefined ? { phoneVerified: patch.phoneVerified } : {}),
        ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.lastLoginAt !== undefined ? { lastLoginAt: patch.lastLoginAt } : {}),
      };
      this.insert(next);
      return this.clone(next)!;
    });
  }

  async claimUsername(input: UsernameClaim): Promise<StoredUser> {
    return this.exclusive(async () => {
      const ownerId = this.byUsername.get(input.usernameNormalized);
      if (ownerId && ownerId !== input.userId) {
        throw new AuthAppError(AuthErrorCode.AUTH_USERNAME_TAKEN);
      }
      const current = this.users.get(input.userId);
      if (!current) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
      if (this.beforeClaimWrite) {
        await this.beforeClaimWrite();
      }
      const ownerAfter = this.byUsername.get(input.usernameNormalized);
      if (ownerAfter && ownerAfter !== input.userId) {
        throw new AuthAppError(AuthErrorCode.AUTH_USERNAME_TAKEN);
      }
      if (current.usernameNormalized && current.usernameNormalized !== input.usernameNormalized) {
        this.byUsername.delete(current.usernameNormalized);
      }
      const next: StoredUser = {
        ...current,
        username: input.username,
        usernameNormalized: input.usernameNormalized,
        providers: [...current.providers],
        preferences: { ...current.preferences },
        updatedAt: new Date(),
      };
      this.users.set(next.id, next);
      this.byUsername.set(input.usernameNormalized, next.id);
      return this.clone(next)!;
    });
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<StoredUser> {
    return this.exclusive(async () => {
      const current = this.users.get(userId);
      if (!current) throw new AuthAppError(AuthErrorCode.AUTH_USER_NOT_FOUND);
      const next: StoredUser = {
        ...current,
        providers: [...current.providers],
        preferences: patch.preferences
          ? { ...current.preferences, ...patch.preferences }
          : { ...current.preferences },
        updatedAt: new Date(),
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
        ...(patch.onboardingCompleted !== undefined
          ? { onboardingCompleted: patch.onboardingCompleted }
          : {}),
      };
      this.users.set(next.id, next);
      return this.clone(next)!;
    });
  }

  async writeAudit(input: AuditWrite): Promise<void> {
    const metadata: { provider?: string; reason?: string } = {};
    const provider = shortMeta(input.metadata?.provider);
    const reason = shortMeta(input.metadata?.reason);
    if (provider !== undefined) metadata.provider = provider;
    if (reason !== undefined) metadata.reason = reason;
    this.audits.push({
      userId: input.userId,
      firebaseUid: input.firebaseUid,
      event: input.event,
      metadata,
    });
  }

  async deleteUserCascade(userId: string): Promise<void> {
    await this.exclusive(async () => {
      const current = this.users.get(userId);
      if (!current) return;
      this.detachIndexes(current);
      this.users.delete(userId);
      for (const audit of this.audits) {
        if (audit.userId === userId) audit.userId = null;
      }
    });
  }

  async isUsernameTaken(usernameNormalized: string, exceptUserId?: string): Promise<boolean> {
    const ownerId = this.byUsername.get(usernameNormalized);
    return ownerId !== undefined && ownerId !== exceptUserId;
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private insert(user: StoredUser): void {
    this.users.set(user.id, user);
    this.byUid.set(user.firebaseUid, user.id);
    if (user.email) this.byEmail.set(user.email, user.id);
    if (user.usernameNormalized) this.byUsername.set(user.usernameNormalized, user.id);
    if (user.phoneNumber && user.phoneVerified) this.verifiedPhones.set(user.phoneNumber, user.id);
  }

  private detachIndexes(user: StoredUser): void {
    this.byUid.delete(user.firebaseUid);
    if (user.email) this.byEmail.delete(user.email);
    if (user.usernameNormalized && this.byUsername.get(user.usernameNormalized) === user.id) {
      this.byUsername.delete(user.usernameNormalized);
    }
    if (user.phoneNumber && this.verifiedPhones.get(user.phoneNumber) === user.id) {
      this.verifiedPhones.delete(user.phoneNumber);
    }
  }

  private clone(user: StoredUser | undefined): StoredUser | null {
    if (!user) return null;
    return {
      ...user,
      providers: [...user.providers],
      preferences: { ...user.preferences },
    };
  }
}
