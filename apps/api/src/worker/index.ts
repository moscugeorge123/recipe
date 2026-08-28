/**
 * Worker process entry point. Boots Redis connectivity and waits for pipeline
 * registration (Phase 4). Exits immediately on startup failure.
 */
import { config } from '../config/env.js';
import { registerWorkerShutdown, startWorker } from './bootstrap.js';

try {
  const log = await startWorker(config);
  registerWorkerShutdown(log, config);
} catch (error: unknown) {
  console.error('Failed to start worker:', error);
  process.exit(1);
}
