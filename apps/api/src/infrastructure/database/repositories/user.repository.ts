import { DEFAULT_CATEGORIES } from '@recipe/contracts';
import { Prisma, type PrismaClient, type User } from '@prisma/client';

import type {
  IUserRepository,
  UserIdentityInput,
  UserRecord,
} from '../../../modules/profiles/repository/user.repository.js';

function toRecord(user: User): UserRecord {
  return {
    id: user.id,
    authSubject: user.authSubject,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findOrCreateByAuthSubject(identity: UserIdentityInput): Promise<UserRecord> {
    const existing = await this.findByAuthSubject(identity.authSubject);
    if (existing) {
      return toRecord(await this.refresh(existing, identity));
    }

    try {
      return toRecord(await this.create(identity));
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      // A concurrent first request for the same account won the race (a new user's app fires
      // several calls at once) ...
      const raced = await this.findByAuthSubject(identity.authSubject);
      if (raced) {
        return toRecord(raced);
      }

      // ... otherwise the email already belongs to another row. The account still gets in; the
      // address is simply not recorded.
      return toRecord(
        await this.create({ authSubject: identity.authSubject, ...nameOf(identity) }),
      );
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? toRecord(user) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.user.deleteMany({ where: { id } });
    return result.count > 0;
  }

  private findByAuthSubject(authSubject: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { authSubject } });
  }

  /** The user and their default categories are created together or not at all. */
  private create(identity: UserIdentityInput): Promise<User> {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authSubject: identity.authSubject,
          ...(identity.email !== undefined ? { email: identity.email } : {}),
          ...(identity.displayName !== undefined ? { displayName: identity.displayName } : {}),
        },
      });

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((category) => ({ userId: user.id, ...category })),
        skipDuplicates: true,
      });

      return user;
    });
  }

  /** Copies changed provider details onto the row; an email clash never blocks sign-in. */
  private async refresh(user: User, identity: UserIdentityInput): Promise<User> {
    const newName =
      identity.displayName !== undefined && identity.displayName !== user.displayName
        ? identity.displayName
        : undefined;
    const newEmail =
      identity.email !== undefined && identity.email !== user.email ? identity.email : undefined;
    if (newName === undefined && newEmail === undefined) {
      return user;
    }

    try {
      return await this.db.user.update({
        where: { id: user.id },
        data: {
          ...(newName !== undefined ? { displayName: newName } : {}),
          ...(newEmail !== undefined ? { email: newEmail } : {}),
        },
      });
    } catch (error) {
      if (newEmail === undefined || !isUniqueViolation(error)) {
        throw error;
      }
      // The new email belongs to another row: keep the old address, still sync the name.
      return newName !== undefined
        ? this.db.user.update({ where: { id: user.id }, data: { displayName: newName } })
        : user;
    }
  }
}

function nameOf(identity: UserIdentityInput): Pick<UserIdentityInput, 'displayName'> {
  return identity.displayName !== undefined ? { displayName: identity.displayName } : {};
}
