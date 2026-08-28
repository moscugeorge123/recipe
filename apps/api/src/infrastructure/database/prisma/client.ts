import { PrismaClient } from '@prisma/client';

import { config } from '../../../config/env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared Prisma client singleton.
 *
 * In development the instance is attached to `globalThis` so hot reload does not
 * exhaust database connections. Production and tests create one instance per process.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: config.database.url },
    },
    log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.nodeEnv === 'development') {
  globalForPrisma.prisma = prisma;
}

/** Disconnects the shared client. Call during graceful shutdown and test teardown. */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
