import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface YtDlpMetadata {
  title?: string;
  description?: string;
  uploader?: string;
  language?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
}

export interface YtDlpDownloadResult {
  filePath: string;
  metadata: YtDlpMetadata;
}

export interface VideoDownloadClient {
  fetchMetadata(url: string): Promise<YtDlpMetadata>;
  download(url: string, destPath: string): Promise<YtDlpDownloadResult>;
}

/** Wraps the yt-dlp CLI for YouTube metadata and video download. */
export class YtDlpClient implements VideoDownloadClient {
  constructor(private readonly binary = 'yt-dlp') {}

  async fetchMetadata(url: string): Promise<YtDlpMetadata> {
    const { stdout } = await execFileAsync(this.binary, ['--dump-single-json', '--no-download', url], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return JSON.parse(stdout) as YtDlpMetadata;
  }

  async download(url: string, destPath: string): Promise<YtDlpDownloadResult> {
    await mkdir(path.dirname(destPath), { recursive: true });
    const outputTemplate = destPath.replace(/\.[^.]+$/, '.%(ext)s');

    const { stdout } = await execFileAsync(
      this.binary,
      ['--dump-single-json', '-o', outputTemplate, url],
      { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
    );

    const metadata = JSON.parse(stdout) as YtDlpMetadata & { _filename?: string };
    const filePath = metadata._filename ?? destPath;

    return { filePath, metadata };
  }

  /** Removes a downloaded file after processing. */
  async cleanup(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }
}
