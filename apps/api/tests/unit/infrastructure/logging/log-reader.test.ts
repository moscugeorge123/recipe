import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileLogReader } from '../../../../src/infrastructure/logging/log-reader.js';

const directories: string[] = [];

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'log-reader-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('FileLogReader', () => {
  it('reads JSON log lines, skips garbage, and returns the newest first', async () => {
    const directory = await tempDir();
    await writeFile(
      path.join(directory, 'api.log'),
      [
        JSON.stringify({
          level: 'info',
          time: '2026-10-08T10:00:00.000Z',
          msg: 'started import',
          service: 'api',
          jobId: 'job-1',
          step: 'extract',
          durationMs: 12,
          requestId: 'req-1',
        }),
        'this is not json',
        JSON.stringify({
          level: 'error',
          timestamp: '2026-10-08T11:00:00.000Z',
          msg: 'boom',
          jobId: 'job-2',
          step: 'ocr',
        }),
        '',
      ].join('\n'),
    );
    await mkdir(path.join(directory, 'nested'));
    await writeFile(
      path.join(directory, 'nested', 'nested.log'),
      JSON.stringify({ level: 'info', time: '2026-10-08T12:00:00.000Z', msg: 'nested-secret' }),
    );
    await writeFile(path.join(directory, 'notes.txt'), 'not a log');

    const outside = await tempDir();
    await writeFile(
      path.join(outside, 'secret.log'),
      JSON.stringify({ level: 'info', time: '2026-10-08T13:00:00.000Z', msg: 'secret-outside' }),
    );
    await symlink(path.join(outside, 'secret.log'), path.join(directory, 'escape.log'));

    const reader = new FileLogReader(directory);
    const all = await reader.read({ page: 1, pageSize: 20 });

    expect(all.total).toBe(2);
    expect(all.entries.map((entry) => entry.msg)).toEqual(['boom', 'started import']);
    expect(all.entries[1]).toEqual({
      timestamp: '2026-10-08T10:00:00.000Z',
      level: 'info',
      msg: 'started import',
      service: 'api',
      jobId: 'job-1',
      step: 'extract',
      durationMs: 12,
      requestId: 'req-1',
    });

    const filtered = await reader.read({ page: 1, pageSize: 10, q: 'BOOM', level: 'ERROR' });
    expect(filtered.total).toBe(1);
    expect(filtered.entries[0]?.msg).toBe('boom');

    const byStep = await reader.read({ page: 1, pageSize: 10, q: 'Extract' });
    expect(byStep.entries.map((entry) => entry.jobId)).toEqual(['job-1']);

    const byJob = await reader.read({ page: 1, pageSize: 10, jobId: 'job-1' });
    expect(byJob.total).toBe(1);

    const page = await reader.read({ page: 2, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]?.msg).toBe('started import');
  });

  it('returns an empty page when the directory is missing', async () => {
    const missing = new FileLogReader(undefined);
    await expect(missing.read({ page: 1, pageSize: 10 })).resolves.toEqual({
      entries: [],
      total: 0,
    });

    const absent = new FileLogReader(path.join(os.tmpdir(), 'log-reader-does-not-exist'));
    await expect(absent.read({ page: 1, pageSize: 10 })).resolves.toEqual({
      entries: [],
      total: 0,
    });
  });

  it('keeps only the 14 newest log files', async () => {
    const directory = await tempDir();
    for (let index = 0; index < 15; index += 1) {
      const name = `file-${String(index).padStart(2, '0')}.log`;
      const filePath = path.join(directory, name);
      await writeFile(
        filePath,
        JSON.stringify({
          level: 'info',
          time: `2026-10-08T00:00:${String(index).padStart(2, '0')}.000Z`,
          msg: `file-${String(index)}`,
        }),
      );
      const when = new Date(Date.UTC(2026, 0, index + 1));
      await utimes(filePath, when, when);
    }

    const result = await new FileLogReader(directory).read({ page: 1, pageSize: 20 });
    const messages = result.entries.map((entry) => entry.msg);
    expect(result.total).toBe(14);
    expect(messages).not.toContain('file-0');
    expect(messages).toContain('file-14');
  });

  it('reads only the tail of a large file and skips a line cut in half', async () => {
    const directory = await tempDir();
    const head = `${JSON.stringify({
      level: 'info',
      time: '2026-10-08T00:00:00.000Z',
      msg: 'OLD_SHOULD_DROP',
    })}\n`;
    const padding = `${'x'.repeat(1_600_000)}\n`;
    const tail = `${JSON.stringify({
      level: 'info',
      time: '2026-10-08T00:00:02.000Z',
      msg: 'TAIL_KEEP',
    })}\n`;
    await writeFile(path.join(directory, 'big.log'), head + padding + tail);

    const result = await new FileLogReader(directory).read({ page: 1, pageSize: 10 });
    expect(result.entries.map((entry) => entry.msg)).toEqual(['TAIL_KEEP']);
  });
});
