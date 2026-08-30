/**
 * Timed start/complete/fail logs for a unit of work.
 *
 * A hang shows up as a `started` line with no matching `completed`/`failed`.
 */

export interface StepLogger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export async function logStep<T>(
  log: StepLogger,
  step: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  log.info({ step, ...fields }, `${step} started`);
  try {
    const result = await run();
    log.info({ step, ...fields, durationMs: Date.now() - startedAt }, `${step} completed`);
    return result;
  } catch (error: unknown) {
    log.error(
      { step, ...fields, durationMs: Date.now() - startedAt, err: error },
      `${step} failed`,
    );
    throw error;
  }
}
