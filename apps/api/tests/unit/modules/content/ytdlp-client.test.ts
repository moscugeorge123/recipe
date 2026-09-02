import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  formatYtDlpError,
  isYtDlpAvailable,
  YtDlpClient,
  type ExecFileFn,
} from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';

function enoentError(): NodeJS.ErrnoException {
  const error = new Error('spawn yt-dlp ENOENT') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}

describe('formatYtDlpError', () => {
  it('mentions a missing binary on ENOENT', () => {
    expect(formatYtDlpError('Failed to fetch YouTube metadata', enoentError())).toBe(
      'Failed to fetch YouTube metadata: yt-dlp is not installed or not on PATH',
    );
  });

  it('includes truncated stderr from the CLI', () => {
    const error = Object.assign(new Error('Command failed'), {
      stderr: 'ERROR: [youtube] abc: Sign in to confirm you’re not a bot\n',
    });
    expect(formatYtDlpError('Failed to download YouTube video', error)).toContain(
      'Sign in to confirm',
    );
  });
});

describe('YtDlpClient', () => {
  it('passes playlist and player-client flags when fetching metadata', async () => {
    const execFile = vi.fn<ExecFileFn>(async () => ({
      stdout: JSON.stringify({ title: 'Cake', description: 'Bake it' }),
      stderr: '',
    }));

    const client = new YtDlpClient('yt-dlp', execFile);
    const metadata = await client.fetchMetadata('https://www.youtube.com/watch?v=abc');

    expect(metadata.title).toBe('Cake');
    expect(execFile).toHaveBeenCalledWith(
      'yt-dlp',
      expect.arrayContaining([
        '--no-playlist',
        '--extractor-args',
        'youtube:player_client=android,web',
        '--js-runtimes',
        'node',
        '--dump-single-json',
        '--no-download',
        'https://www.youtube.com/watch?v=abc',
      ]),
      expect.objectContaining({ timeout: 120_000 }),
    );
  });

  it('wraps ENOENT from execFile when fetching metadata', async () => {
    const execFile = vi.fn<ExecFileFn>(async () => {
      throw enoentError();
    });

    const client = new YtDlpClient('yt-dlp', execFile);
    await expect(client.fetchMetadata('https://www.youtube.com/watch?v=abc')).rejects.toThrow(
      /yt-dlp is not installed/,
    );
  });

  it('uses a resilient format and reports the downloaded filename', async () => {
    const dir = path.join(os.tmpdir(), `ytdlp-test-${String(Date.now())}`);
    await mkdir(dir, { recursive: true });
    const destPath = path.join(dir, 'video.mp4');
    const written = path.join(dir, 'video.webm');
    await writeFile(written, 'fake');

    const execFile = vi.fn<ExecFileFn>(async () => ({
      stdout: JSON.stringify({ title: 'Cake', _filename: written }),
      stderr: '',
    }));

    const client = new YtDlpClient('/usr/bin/yt-dlp', execFile);
    const result = await client.download('https://youtu.be/abc', destPath);

    expect(result.filePath).toBe(written);
    expect(execFile).toHaveBeenCalledWith(
      '/usr/bin/yt-dlp',
      expect.arrayContaining(['-f', 'bv*+ba/b', '--no-playlist', '--no-simulate']),
      expect.objectContaining({ timeout: 300_000 }),
    );
  });

  it('fails the download when yt-dlp reports a path that was not written', async () => {
    const destPath = path.join(os.tmpdir(), `ytdlp-missing-${String(Date.now())}`, 'video.mp4');
    const execFile = vi.fn<ExecFileFn>(async () => ({
      stdout: JSON.stringify({ title: 'Cake', _filename: destPath }),
      stderr: '',
    }));

    const client = new YtDlpClient('yt-dlp', execFile);
    await expect(client.download('https://youtu.be/abc', destPath)).rejects.toThrow(
      /file was not written/,
    );
  });

  it('reports yt-dlp as unavailable when --version fails', async () => {
    const execFile = vi.fn<ExecFileFn>(async () => {
      throw enoentError();
    });
    await expect(isYtDlpAvailable('yt-dlp', execFile)).resolves.toBe(false);
  });
});
