import { PrismaClient } from '@prisma/client';

import { DEFAULT_TEST_DATABASE_URL, resolveDatabaseUrl } from '../../src/config/env.js';
import { PrismaProfileBootstrapRepository } from '../../src/infrastructure/database/repositories/profile-bootstrap.repository.js';

const TEST_DATABASE_URL = resolveDatabaseUrl({
  nodeEnv: 'test',
  databaseUrl: process.env['DATABASE_URL'] ?? DEFAULT_TEST_DATABASE_URL,
  ...(process.env['TEST_DATABASE_URL'] !== undefined
    ? { testDatabaseUrl: process.env['TEST_DATABASE_URL'] }
    : {}),
});

function databaseName(url: string): string | undefined {
  try {
    return new URL(url).pathname.replace(/^\//, '') || undefined;
  } catch {
    return undefined;
  }
}

if (databaseName(TEST_DATABASE_URL) === 'recipe_api') {
  throw new Error(
    'Refusing to run database tests against recipe_api. Set TEST_DATABASE_URL to recipe_api_test.',
  );
}

let testPrisma: PrismaClient | undefined;

/** Returns a Prisma client pointed at the test database. */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  }
  return testPrisma;
}

/** Truncates all application tables between tests and restores migration-level defaults. */
export async function resetDatabase(
  db: PrismaClient = getTestPrisma(),
  options: { bootstrapDefaults?: boolean } = {},
): Promise<void> {
  const tables = [
    'ai_usage',
    'collection_recipes',
    'collections',
    'recipe_notes',
    'recipe_categories',
    'recipe_revision_categories',
    'recipe_revision_steps',
    'recipe_revision_ingredients',
    'recipe_revisions',
    'pantry_items',
    'shopping_list_items',
    'meal_plan_entries',
    'extraction_evidence',
    'vision_analyses',
    'ocr_results',
    'transcript_segments',
    'transcripts',
    'media_assets',
    'recipe_steps',
    'recipe_ingredients',
    'cook_session_step_stats',
    'cook_sessions',
    'user_recipes',
    'categories',
    'recipes',
    'extraction_stages',
    'extraction_jobs',
    'recipe_sources',
    'users',
  ];

  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  if (options.bootstrapDefaults !== false) {
    await new PrismaProfileBootstrapRepository(db).ensureDefaults();
  }
}

export async function disconnectTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = undefined;
  }
}

/** Skips database integration tests when Postgres is unreachable. */
export async function isDatabaseAvailable(): Promise<boolean> {
  const db = getTestPrisma();
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Distinguishes a reachable database from one that has not applied the foundation migration. */
export async function isPersistenceFoundationAvailable(): Promise<boolean> {
  if (!(await isDatabaseAvailable())) {
    return false;
  }

  const db = getTestPrisma();
  const rows = await db.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.users')::text AS "tableName"
  `;
  return rows[0]?.tableName === 'users';
}
