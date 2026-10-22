import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  configurePhotoImportTrace,
  PHOTO_IMPORT_LOG_FILE,
  photoImportLogPath,
  tracePhotoImport,
} from './photo-import-trace.js';

describe('photo import trace', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    configurePhotoImportTrace(undefined);
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('appends the step and its payload as one JSON line', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'photo-import-log-'));
    dirs.push(dir);
    configurePhotoImportTrace(dir);

    tracePhotoImport({
      jobId: 'job-1',
      step: 'ai.ocr',
      phase: 'completed',
      data: { text: '1 cup flour\n2 eggs', confidence: 0.8 },
    });

    const file = photoImportLogPath();
    expect(file?.startsWith(dir)).toBe(true);
    expect(path.basename(file ?? '')).toMatch(new RegExp(`^${PHOTO_IMPORT_LOG_FILE}\\.\\d{4}-\\d{2}-\\d{2}\\.log$`));

    const line = JSON.parse(await readFile(file ?? '', 'utf8')) as Record<string, unknown>;
    expect(line.jobId).toBe('job-1');
    expect(line.step).toBe('ai.ocr');
    expect(line.phase).toBe('completed');
    expect(line.data).toEqual({ text: '1 cup flour\n2 eggs', confidence: 0.8 });
    expect(line.time).toEqual(expect.any(String));
  });

  it('records a failure and does not throw when the directory cannot be used', () => {
    configurePhotoImportTrace(undefined);
    expect(photoImportLogPath()).toBeUndefined();
    expect(() => {
      tracePhotoImport({
        step: 'photo.intake',
        phase: 'failed',
        error: new Error('not an image'),
      });
    }).not.toThrow();
  });

  it('serializes an Error on a failed step', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'photo-import-log-'));
    dirs.push(dir);
    configurePhotoImportTrace(dir);

    tracePhotoImport({
      jobId: 'job-2',
      step: 'pipeline.stage',
      phase: 'failed',
      data: { stage: 'RUNNING_OCR' },
      error: new Error('vision timed out'),
    });

    const line = JSON.parse(await readFile(photoImportLogPath() ?? '', 'utf8')) as {
      error: { name: string; message: string; stack?: string };
      data: { stage: string };
    };
    expect(line.data.stage).toBe('RUNNING_OCR');
    expect(line.error).toMatchObject({ name: 'Error', message: 'vision timed out' });
    expect(line.error.stack).toContain('vision timed out');
  });
});
