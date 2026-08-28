import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config/env.js';
import { registerShutdownHandlers } from './server.js';

/**
 * These tests assert the shutdown *contract* (close once, on both signals, with a watchdog)
 * without terminating the test process. `tests/e2e/graceful-shutdown.test.ts` covers the real
 * signal path against a listening server.
 */
describe('registerShutdownHandlers', () => {
  const config = loadConfig({ NODE_ENV: 'test', SHUTDOWN_TIMEOUT_MS: '50' });

  function createFakeApp(close: () => Promise<void>) {
    return {
      close: vi.fn(close),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
    };
  }

  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    // Leaving handlers behind would make later tests react to signals.
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
    vi.restoreAllMocks();
  });

  it.each(['SIGTERM', 'SIGINT'] as const)('closes the application on %s', async (signal) => {
    const app = createFakeApp(() => Promise.resolve());

    registerShutdownHandlers(app as never, config);
    process.emit(signal);
    await vi.waitFor(() => {
      expect(app.close).toHaveBeenCalledTimes(1);
    });

    expect(app.log.info).toHaveBeenCalledWith({ signal }, expect.stringContaining('Shutdown'));
  });

  it('closes only once when signalled repeatedly', async () => {
    let release: (() => void) | undefined;
    const app = createFakeApp(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    registerShutdownHandlers(app as never, config);
    process.emit('SIGTERM');
    process.emit('SIGINT');
    await vi.waitFor(() => {
      expect(app.close).toHaveBeenCalledTimes(1);
    });

    release?.();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('forces an exit when draining exceeds the timeout', async () => {
    const app = createFakeApp(() => new Promise<void>(() => undefined));

    registerShutdownHandlers(app as never, config);
    process.emit('SIGTERM');

    await vi.waitFor(
      () => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      },
      { timeout: 1000 },
    );
    expect(app.log.error).toHaveBeenCalledWith(
      { timeoutMs: 50 },
      expect.stringContaining('forcing exit'),
    );
  });

  it('exits with a failure code when closing throws', async () => {
    const app = createFakeApp(() => Promise.reject(new Error('pool did not drain')));

    registerShutdownHandlers(app as never, config);
    process.emit('SIGTERM');

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
    expect(app.log.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'Error during shutdown');
  });

  it('shuts down and flags failure on an unhandled rejection', async () => {
    const app = createFakeApp(() => Promise.resolve());
    const previousExitCode = process.exitCode;

    registerShutdownHandlers(app as never, config);
    process.emit('unhandledRejection', new Error('boom'), Promise.resolve());

    await vi.waitFor(() => {
      expect(app.close).toHaveBeenCalledTimes(1);
    });
    expect(app.log.fatal).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    process.exitCode = previousExitCode;
  });
});
