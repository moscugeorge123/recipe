import { describe, expect, it } from 'vitest';

import { logStep, type StepLogger } from './log-step.js';

function collectLogger(): {
  log: StepLogger;
  lines: Array<{ level: string; obj: object; msg?: string | undefined }>;
} {
  const lines: Array<{ level: string; obj: object; msg?: string | undefined }> = [];
  const log: StepLogger = {
    info(obj, msg) {
      lines.push({ level: 'info', obj, msg });
    },
    error(obj, msg) {
      lines.push({ level: 'error', obj, msg });
    },
  };
  return { log, lines };
}

describe('logStep', () => {
  it('logs started then completed with duration on success', async () => {
    const { log, lines } = collectLogger();

    await expect(logStep(log, 'youtube.download', { jobId: 'job-1' }, async () => 'ok')).resolves.toBe(
      'ok',
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      level: 'info',
      msg: 'youtube.download started',
      obj: { step: 'youtube.download', jobId: 'job-1' },
    });
    expect(lines[1]).toMatchObject({
      level: 'info',
      msg: 'youtube.download completed',
      obj: expect.objectContaining({
        step: 'youtube.download',
        jobId: 'job-1',
        durationMs: expect.any(Number),
      }),
    });
  });

  it('logs started then failed and rethrows', async () => {
    const { log, lines } = collectLogger();
    const boom = new Error('yt-dlp hung');

    await expect(logStep(log, 'youtube.metadata', { url: 'https://youtu.be/x' }, async () => {
      throw boom;
    })).rejects.toBe(boom);

    expect(lines[0]?.msg).toBe('youtube.metadata started');
    expect(lines[1]).toMatchObject({
      level: 'error',
      msg: 'youtube.metadata failed',
      obj: expect.objectContaining({
        step: 'youtube.metadata',
        err: boom,
        durationMs: expect.any(Number),
      }),
    });
  });
});
