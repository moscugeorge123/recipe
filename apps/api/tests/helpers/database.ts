import { PrismaClient } from '@prisma/client';

const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/recipe_api_test';

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
