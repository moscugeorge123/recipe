import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * Exercises the real signal path: a listening server, an actual SIGTERM, a clean exit.
 *
 * This is the behaviour ECS/Fargate depends on during every deployment, so it is worth
 * verifying against a real process rather than a mock. Runs locally with no AWS involvement.
 */

const STARTUP_TIMEOUT_MS = 20_000;

interface RunningServer {
  process: ChildProcessWithoutNullStreams;
  port: number;
  output: () => string;
}

async function startServerProcess(): Promise<RunningServer> {
  // Spawned as a single process (rather than through `npx`) so signals reach the server
  // directly, exactly as they do in a container where the app is PID 1.
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      // Port 0 lets the OS pick a free port, so concurrent test runs cannot collide.
      PORT: '0',
      RATE_LIMIT_ENABLED: 'false',
      ENABLE_DOCS: 'false',
    },
    stdio: 'pipe',
  });

  let output = '';
  const collect = (chunk: Buffer): void => {
    output += chunk.toString();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  const startedAt = Date.now();
  let port: number | undefined;

  while (port === undefined) {
    if (Date.now() - startedAt > STARTUP_TIMEOUT_MS) {
      child.kill('SIGKILL');
      throw new Error(`Server did not start within ${String(STARTUP_TIMEOUT_MS)}ms:\n${output}`);
    }
    if (child.exitCode !== null) {
      throw new Error(`Server exited during startup with ${String(child.exitCode)}:\n${output}`);
    }

    const match = /Server listening at http:\/\/[^:]+:(\d+)/.exec(output);
    if (match?.[1] !== undefined) {
      port = Number(match[1]);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { process: child, port, output: () => output };
}

describe('graceful shutdown', () => {
  let server: RunningServer | undefined;

  afterEach(() => {
    if (server?.process.exitCode === null) {
      server.process.kill('SIGKILL');
    }
    server = undefined;
  });

  it('serves traffic, then exits cleanly on SIGTERM', async () => {
    server = await startServerProcess();

    const healthy = await fetch(`http://127.0.0.1:${String(server.port)}/health`);
    expect(healthy.status).toBe(200);
    expect(await healthy.json()).toEqual({ status: 'ok' });

    server.process.kill('SIGTERM');
    const [exitCode] = (await once(server.process, 'exit')) as [number | null, string | null];

    expect(exitCode).toBe(0);
    expect(server.output()).toContain('Shutdown initiated');
    expect(server.output()).toContain('Shutdown complete');
  });

  it('stops accepting connections once shut down', async () => {
    server = await startServerProcess();
    const url = `http://127.0.0.1:${String(server.port)}/health`;

    expect((await fetch(url)).status).toBe(200);

    server.process.kill('SIGTERM');
    await once(server.process, 'exit');

    await expect(fetch(url)).rejects.toThrow();
  });

  it('exits cleanly on SIGINT as well', async () => {
    server = await startServerProcess();

    server.process.kill('SIGINT');
    const [exitCode] = (await once(server.process, 'exit')) as [number | null, string | null];

    expect(exitCode).toBe(0);
  });

  it('logs structured JSON with a request id per request', async () => {
    server = await startServerProcess();

    await fetch(`http://127.0.0.1:${String(server.port)}/api/v1/health`);

    server.process.kill('SIGTERM');
    await once(server.process, 'exit');

    const logLines = server
      .output()
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    const completed = logLines.find((line) => line.msg === 'request completed');
    expect(completed).toBeDefined();
    expect(completed).toMatchObject({
      level: 'info',
      requestId: expect.any(String),
      res: { statusCode: 200 },
      responseTime: expect.any(Number),
      service: 'api',
    });
    expect(completed?.time).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));

    const incoming = logLines.find((line) => line.msg === 'incoming request');
    expect(incoming).toMatchObject({ req: { method: 'GET', url: '/api/v1/health' } });
    // Request logging must not carry headers, which is where credentials live.
    expect(JSON.stringify(incoming)).not.toContain('headers');
  });
});
