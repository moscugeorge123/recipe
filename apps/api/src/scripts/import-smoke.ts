/**
 * Queue one or more links for import and wait for the running worker to finish them.
 *
 *   npm run import:smoke -- <url> [url...]
 *
 * Always force-refreshes, so a link that was imported before is extracted again. Requires the
 * worker (`npm run dev:worker`) to be running. Every step of each job is written to
 * `<LOG_DIR>/import.YYYY-MM-DD.log`; filter it by the printed job id.
 */
import path from 'node:path';

import { config } from '../config/env.js';
import { disconnectPrisma } from '../infrastructure/database/prisma/client.js';
import { IMPORT_LOG_FILE, silentLogger } from '../infrastructure/logging/logger.js';
import { disconnectRedis, getRedisClient } from '../infrastructure/redis/client.js';
import { createContainer } from '../shared/di/container.js';

const POLL_MS = 2_000;
const TIMEOUT_MS = 10 * 60_000;
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

async function main(): Promise<void> {
  const urls = process.argv.slice(2).filter((arg) => arg !== '--');
  if (urls.length === 0) {
    console.error('Usage: npm run import:smoke -- <url> [url...]');
    process.exitCode = 1;
    return;
  }

  const redis = getRedisClient();
  await redis.connect();
  const container = createContainer({ logger: silentLogger() });
  const service = container.extractionJobService;

  const jobs = await Promise.all(
    urls.map(async (url) => {
      try {
        const created = await service.createJob({ url, forceRefresh: true, outputLanguage: 'en' });
        console.log(`queued  ${created.jobId}  ${url}`);
        return { url, jobId: created.jobId };
      } catch (error: unknown) {
        console.log(`REJECTED  ${url}  ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      }
    }),
  );

  const startedAt = Date.now();
  const pending = new Map(
    jobs.flatMap((job) => (job ? [[job.jobId, job.url] as const] : [])),
  );

  while (pending.size > 0 && Date.now() - startedAt < TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    for (const [jobId, url] of pending) {
      const status = await service.getJobStatus(jobId);
      if (!TERMINAL.has(status.status)) {
        continue;
      }
      pending.delete(jobId);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      const detail =
        status.status === 'COMPLETED'
          ? `recipe ${status.recipeId ?? '(none)'}`
          : JSON.stringify(status.error);
      console.log(`${status.status.padEnd(9)} ${jobId}  ${String(seconds)}s  ${url}\n          ${detail}`);
    }
  }

  for (const [jobId, url] of pending) {
    console.log(`TIMEOUT   ${jobId}  ${url}  (is the worker running?)`);
  }

  if (config.logging.directory) {
    console.log(
      `\nStep-by-step logs: ${path.resolve(config.logging.directory, IMPORT_LOG_FILE)}.<date>.log`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectRedis();
    await disconnectPrisma();
  });
