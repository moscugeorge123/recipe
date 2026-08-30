import { execFile } from 'node:child_process';
import { mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface YtDlpThumbnail {
  url?: string;
  width?: number;
  height?: number;
  id?: string;
}

export interface YtDlpMetadata {
  title?: string;
  description?: string;
  uploader?: string;
  language?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: YtDlpThumbnail[];
  webpage_url?: string;
}

export interface YtDlpDownloadResult {
  filePath: string;
  metadata: YtDlpMetadata;
}

export interface FetchMetadataOptions {
  timeoutMs?: number;
}

export interface ExecFileResult {
  stdout: string | Buffer;
  stderr: string | Buffer;
}

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: { timeout?: number; maxBuffer?: number },
) => Promise<ExecFileResult>;

export interface VideoDownloadClient {
  fetchMetadata(url: string, options?: FetchMetadataOptions): Promise<YtDlpMetadata>;
  download(url: string, destPath: string): Promise<YtDlpDownloadResult>;
}

const YTDLP_COMMON_ARGS = [
  '--no-playlist',
  '--extractor-args',
  'youtube:player_client=android,web',
  '--js-runtimes',
  'node',
] as const;

const STDERR_LIMIT = 500;

/** Maps a yt-dlp spawn/CLI failure to a short, diagnosable message. */
export function formatYtDlpError(action: string, error: unknown): string {
  const err = error as NodeJS.ErrnoException & { stderr?: string | Buffer };
  if (err.code === 'ENOENT') {
    return `${action}: yt-dlp is not installed or not on PATH`;
  }

  const stderr = readExecStderr(err.stderr);
  if (stderr) {
    return `${action}: ${stderr.slice(0, STDERR_LIMIT)}`;
  }

  const message = error instanceof Error ? error.message : 'unknown error';
  return `${action}: ${message}`;
}

function readExecStderr(stderr: string | Buffer | undefined): string {
  if (typeof stderr === 'string') {
    return stderr.trim();
  }
  if (Buffer.isBuffer(stderr)) {
    return stderr.toString('utf8').trim();
  }
  return '';
}

/** Returns true when the yt-dlp binary can be executed. */
export async function isYtDlpAvailable(
  binary = 'yt-dlp',
  execFile: ExecFileFn = execFileAsync,
): Promise<boolean> {
  try {
    await execFile(binary, ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/** Wraps the yt-dlp CLI for YouTube metadata and video download. */
export class YtDlpClient implements VideoDownloadClient {
  constructor(
    private readonly binary = 'yt-dlp',
    private readonly execFile: ExecFileFn = execFileAsync,
  ) {}

  async fetchMetadata(url: string, options: FetchMetadataOptions = {}): Promise<YtDlpMetadata> {
    try {
      const { stdout } = await this.execFile(
        this.binary,
        [...YTDLP_COMMON_ARGS, '--dump-single-json', '--no-download', url],
        {
          timeout: options.timeoutMs ?? 120_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      return JSON.parse(stdoutToString(stdout)) as YtDlpMetadata;
    } catch (error: unknown) {
      throw new Error(formatYtDlpError('Failed to fetch YouTube metadata', error), { cause: error });
    }
  }

  async download(url: string, destPath: string): Promise<YtDlpDownloadResult> {
    await mkdir(path.dirname(destPath), { recursive: true });
    const outputTemplate = destPath.replace(/\.[^.]+$/, '.%(ext)s');

    try {
      const { stdout } = await this.execFile(
        this.binary,
        [
          ...YTDLP_COMMON_ARGS,
          '--no-simulate',
          '--dump-single-json',
          '-f',
          'bv*+ba/b',
          '-o',
          outputTemplate,
          url,
        ],
        { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
      );

      const metadata = JSON.parse(stdoutToString(stdout)) as YtDlpMetadata & {
        _filename?: string;
        requested_downloads?: Array<{ filepath?: string }>;
      };
      const filePath =
        metadata.requested_downloads?.[0]?.filepath ?? metadata._filename ?? destPath;

      const exists = await access(filePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        throw new Error(`yt-dlp reported ${filePath} but the file was not written`);
      }

      return { filePath, metadata };
    } catch (error: unknown) {
      throw new Error(formatYtDlpError('Failed to download YouTube video', error), { cause: error });
    }
  }

  /** Removes a downloaded file after processing. */
  async cleanup(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }
}

function stdoutToString(stdout: string | Buffer): string {
  return typeof stdout === 'string' ? stdout : stdout.toString('utf8');
}
