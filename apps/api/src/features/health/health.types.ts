export type HealthStatus = 'ok' | 'error';

/**
 * A single dependency probe.
 *
 * Implementations resolve when the dependency is usable and reject otherwise; the health
 * service is responsible for timing them and catching failures.
 */
export interface DependencyCheck {
  name: string;
  check: () => Promise<void>;
}

export interface DependencyCheckResult {
  name: string;
  status: HealthStatus;
  durationMs: number;
  /**
   * Only for server-side logging. The HTTP layer maps results to the response explicitly and
   * never forwards this, because dependency errors contain hostnames, ports and driver details.
   */
  error?: unknown;
}

export interface HealthReport {
  status: HealthStatus;
  checks: DependencyCheckResult[];
}

export interface HealthService {
  getReport: () => Promise<HealthReport>;
}
