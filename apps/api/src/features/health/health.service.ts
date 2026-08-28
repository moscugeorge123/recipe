import type {
  DependencyCheck,
  DependencyCheckResult,
  HealthReport,
  HealthService,
} from './health.types.js';

/**
 * Aggregates dependency checks into a single report.
 *
 * There are no checks registered yet because the application has no external dependencies.
 * When one is added, register it where the health routes are wired up — nothing else changes:
 *
 *   createHealthService([
 *     { name: 'database', check: () => db.raw('select 1') },
 *     { name: 'cache', check: () => redis.ping().then(() => undefined) },
 *   ]);
 *
 * Checks run in parallel so total latency is that of the slowest dependency, and a rejected
 * check degrades the report instead of throwing.
 */
export function createHealthService(checks: readonly DependencyCheck[] = []): HealthService {
  async function runCheck(dependency: DependencyCheck): Promise<DependencyCheckResult> {
    const startedAt = performance.now();

    try {
      await dependency.check();
      return {
        name: dependency.name,
        status: 'ok',
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error: unknown) {
      return {
        name: dependency.name,
        status: 'error',
        durationMs: Math.round(performance.now() - startedAt),
        error,
      };
    }
  }

  return {
    async getReport(): Promise<HealthReport> {
      const results = await Promise.all(checks.map(runCheck));

      return {
        status: results.every((result) => result.status === 'ok') ? 'ok' : 'error',
        checks: results,
      };
    },
  };
}
