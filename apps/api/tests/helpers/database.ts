import { PrismaClient } from '@prisma/client';

import { DEFAULT_TEST_DATABASE_URL, resolveDatabaseUrl } from '../../src/config/env.js';

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

/** Truncates all application tables between tests. */
export async function resetDatabase(db: PrismaClient = getTestPrisma()): Promise<void> {
  const tables = [
    'ai_usage',
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
    'recipes',
    'extraction_stages',
    'extraction_jobs',
    'recipe_sources',
  ];

  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
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
