/**
 * Hands the pre-authentication data (the singleton default profile) to a Firebase account.
 *
 *   npm run claim-profile -- --uid <firebaseUid> [--email <address>] [--name <display name>] [--force]
 *
 * Data never moves: the default `users` row simply becomes that Firebase user, so its recipes,
 * categories, collections, pantry, shopping list, meal plan and cook sessions are theirs from the
 * next request on. With a service account configured the email and name are read from Firebase;
 * otherwise pass `--email` (and optionally `--name`).
 *
 * Signing in before running this creates an empty account for the uid. That account is removed
 * first, unless it already owns recipes (then the script aborts, or deletes it with `--force`).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { Prisma, type PrismaClient } from '@prisma/client';
import { getAuth } from 'firebase-admin/auth';

import { config } from '../config/env.js';
import { getFirebaseApp } from '../infrastructure/auth/firebase-app.js';
import { disconnectPrisma, prisma } from '../infrastructure/database/prisma/client.js';
import { DEFAULT_PROFILE_ID } from '../modules/profiles/domain/profile.js';

export interface ClaimOptions {
  uid: string;
  email?: string;
  displayName?: string;
  /** Allows replacing an account that already owns recipes, or re-pointing a claimed profile. */
  force?: boolean;
}

export interface ClaimSummary {
  userId: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  removedEmptyAccount: boolean;
  counts: Record<string, number>;
}

export class ClaimError extends Error {}

/** Everything the default profile owns, reported so the operator can sanity-check the result. */
async function countOwnedData(
  db: Prisma.TransactionClient,
  userId: string,
): Promise<Record<string, number>> {
  const [recipes, categories, collections, cookSessions, pantryItems, shoppingListItems, mealPlan] =
    await Promise.all([
      db.userRecipe.count({ where: { userId } }),
      db.category.count({ where: { userId } }),
      db.collection.count({ where: { userId } }),
      db.cookSession.count({ where: { userId } }),
      db.pantryItem.count({ where: { userId } }),
      db.shoppingListItem.count({ where: { userId } }),
      db.mealPlanEntry.count({ where: { userId } }),
    ]);

  return {
    recipes,
    categories,
    collections,
    cookSessions,
    pantryItems,
    shoppingListItems,
    mealPlanEntries: mealPlan,
  };
}

export async function claimDefaultProfile(
  db: PrismaClient,
  options: ClaimOptions,
): Promise<ClaimSummary> {
  return db.$transaction(async (tx) => {
    const defaultUser = await tx.user.findUnique({ where: { id: DEFAULT_PROFILE_ID } });
    if (!defaultUser) {
      throw new ClaimError('The default profile does not exist, so there is nothing to claim.');
    }
    if (defaultUser.authSubject === options.uid) {
      throw new ClaimError('The default profile already belongs to this Firebase uid.');
    }
    if (defaultUser.authSubject !== null && options.force !== true) {
      throw new ClaimError(
        `The default profile is already claimed by another account (${defaultUser.authSubject}). Use --force to take it over.`,
      );
    }

    let removedEmptyAccount = false;
    const existing = await tx.user.findUnique({ where: { authSubject: options.uid } });
    if (existing) {
      const recipeCount = await tx.userRecipe.count({ where: { userId: existing.id } });
      if (recipeCount > 0 && options.force !== true) {
        throw new ClaimError(
          `This uid already has an account with ${String(recipeCount)} recipe(s). Use --force to delete it and claim the default profile instead.`,
        );
      }
      await tx.user.delete({ where: { id: existing.id } });
      removedEmptyAccount = true;
    }

    const email = options.email ?? existing?.email ?? null;
    const displayName = options.displayName ?? existing?.displayName ?? defaultUser.displayName;

    try {
      await tx.user.update({
        where: { id: DEFAULT_PROFILE_ID },
        data: { authSubject: options.uid, email, displayName, profileKey: null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ClaimError(
          `The email ${email ?? ''} already belongs to a different account. Pass --email with another address.`,
        );
      }
      throw error;
    }

    return {
      userId: DEFAULT_PROFILE_ID,
      uid: options.uid,
      email,
      displayName,
      removedEmptyAccount,
      counts: await countOwnedData(tx, DEFAULT_PROFILE_ID),
    };
  });
}

/** Reads email and name from Firebase when a service account is available. */
async function lookupFirebaseProfile(
  uid: string,
): Promise<{ email?: string; displayName?: string } | undefined> {
  if (config.auth.firebaseServiceAccountJson === undefined) {
    return undefined;
  }

  const record = await getAuth(getFirebaseApp(config.auth)).getUser(uid);
  return {
    ...(record.email !== undefined ? { email: record.email } : {}),
    ...(record.displayName !== undefined ? { displayName: record.displayName } : {}),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      uid: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
  });

  if (values.uid === undefined || values.uid === '') {
    console.error(
      'Usage: npm run claim-profile -- --uid <firebaseUid> [--email <address>] [--name <name>] [--force]',
    );
    process.exitCode = 1;
    return;
  }

  const fromFirebase = await lookupFirebaseProfile(values.uid);
  const email = values.email ?? fromFirebase?.email;
  const displayName = values.name ?? fromFirebase?.displayName;
  if (email === undefined) {
    console.warn(
      'No email available (no service account and no --email): the profile is claimed without one.',
    );
  }

  const summary = await claimDefaultProfile(prisma, {
    uid: values.uid,
    force: values.force,
    ...(email !== undefined ? { email } : {}),
    ...(displayName !== undefined ? { displayName } : {}),
  });

  console.log(`Claimed the default profile (${summary.userId}) for Firebase uid ${summary.uid}`);
  console.log(`  email:        ${summary.email ?? '(none)'}`);
  console.log(`  display name: ${summary.displayName ?? '(none)'}`);
  if (summary.removedEmptyAccount) {
    console.log('  removed the account created by an earlier sign-in with this uid');
  }
  for (const [name, count] of Object.entries(summary.counts)) {
    console.log(`  ${name.padEnd(18)} ${String(count)}`);
  }
  console.log('Relaunch the app (or sign in again) to see the data.');
}

// Only run when invoked directly, so tests can import `claimDefaultProfile`.
if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof ClaimError ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => disconnectPrisma());
}
