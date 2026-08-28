import { describe, expect, it, vi } from 'vitest';

import { createHealthService } from './health.service.js';

describe('createHealthService', () => {
  it('reports ok when no dependencies are registered', async () => {
    const report = await createHealthService().getReport();

    expect(report).toEqual({ status: 'ok', checks: [] });
  });

  it('reports ok when every check passes', async () => {
    const service = createHealthService([
      { name: 'database', check: async () => undefined },
      { name: 'cache', check: async () => undefined },
    ]);

    const report = await service.getReport();

    expect(report.status).toBe('ok');
    expect(report.checks.map((check) => check.name)).toEqual(['database', 'cache']);
    expect(report.checks.every((check) => check.status === 'ok')).toBe(true);
  });

  it('reports error and keeps the cause for logging when a check fails', async () => {
    const failure = new Error('connect ECONNREFUSED 10.0.1.15:5432');
    const service = createHealthService([
      { name: 'database', check: () => Promise.reject(failure) },
      { name: 'cache', check: async () => undefined },
    ]);

    const report = await service.getReport();

    expect(report.status).toBe('error');
    expect(report.checks).toEqual([
      { name: 'database', status: 'error', durationMs: expect.any(Number), error: failure },
      { name: 'cache', status: 'ok', durationMs: expect.any(Number) },
    ]);
  });

  it('measures each check and runs them in parallel', async () => {
    const slow = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const service = createHealthService([
      { name: 'a', check: slow },
      { name: 'b', check: slow },
    ]);

    const startedAt = performance.now();
    const report = await service.getReport();
    const elapsed = performance.now() - startedAt;

    expect(slow).toHaveBeenCalledTimes(2);
    expect(report.checks[0]?.durationMs).toBeGreaterThanOrEqual(20);
    // Sequential execution would take at least 50ms.
    expect(elapsed).toBeLessThan(45);
  });
});
