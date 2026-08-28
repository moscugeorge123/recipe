import { execFile } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { MediaProcessingFailedError } from '../../../shared/errors/extraction-errors.js';
import type {
  FrameExtractionOptions,
  MediaMetadata,
  MediaProcessor,
} from '../domain/types.js';

const execFileAsync = promisify(execFile);

export class FfmpegMediaProcessor implements MediaProcessor {
  constructor(
    private readonly ffmpegPath = 'ffmpeg',
    private readonly ffprobePath = 'ffprobe',
    private readonly timeoutMs = 120_000,
  ) {}

  async extractAudio(inputPath: string, outputPath: string): Promise<string> {
    await mkdir(path.dirname(outputPath), { recursive: true });

    try {
      await execFileAsync(
        this.ffmpegPath,
        ['-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-y', outputPath],
        { timeout: this.timeoutMs },
      );
    } catch (error: unknown) {
      throw new MediaProcessingFailedError({
        message: 'Failed to extract audio',
        cause: error,
      });
    }

    return outputPath;
  }

  async extractFrames(inputPath: string, opts: FrameExtractionOptions): Promise<string[]> {
    await mkdir(opts.outputDir, { recursive: true });
    const pattern = path.join(opts.outputDir, 'frame-%04d.jpg');

    try {
      const args = ['-i', inputPath, '-vf', `fps=1/${String(opts.intervalSeconds)}`];
      if (opts.maxFrames !== undefined) {
        args.push('-frames:v', String(opts.maxFrames));
      }
      args.push('-y', pattern);

      await execFileAsync(this.ffmpegPath, args, { timeout: this.timeoutMs });
    } catch (error: unknown) {
      throw new MediaProcessingFailedError({
        message: 'Failed to extract frames',
        cause: error,
      });
    }

    const files = await readdir(opts.outputDir);
    return files
      .filter((f) => f.startsWith('frame-') && f.endsWith('.jpg'))
      .sort()
      .map((f) => path.join(opts.outputDir, f));
  }

  async generateThumbnail(inputPath: string, outputPath: string): Promise<string> {
    await mkdir(path.dirname(outputPath), { recursive: true });

    try {
      await execFileAsync(
        this.ffmpegPath,
        ['-i', inputPath, '-ss', '00:00:01', '-vframes', '1', '-y', outputPath],
        { timeout: this.timeoutMs },
      );
    } catch (error: unknown) {
      throw new MediaProcessingFailedError({
        message: 'Failed to generate thumbnail',
        cause: error,
      });
    }

    return outputPath;
  }

  async getMetadata(inputPath: string): Promise<MediaMetadata> {
    try {
      const { stdout } = await execFileAsync(
        this.ffprobePath,
        ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
        { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 },
      );

      const parsed = JSON.parse(stdout) as {
        format?: { duration?: string };
        streams?: Array<{ codec_type?: string; width?: number; height?: number; codec_name?: string }>;
      };

      const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');

      return {
        durationSeconds: Number.parseFloat(parsed.format?.duration ?? '0') || 0,
        mimeType: 'video/mp4',
        ...(videoStream?.width !== undefined ? { width: videoStream.width } : {}),
        ...(videoStream?.height !== undefined ? { height: videoStream.height } : {}),
        ...(videoStream?.codec_name ? { codec: videoStream.codec_name } : {}),
      };
    } catch (error: unknown) {
      throw new MediaProcessingFailedError({
        message: 'Failed to read media metadata',
        cause: error,
      });
    }
  }
}

/** Returns true when ffmpeg and ffprobe binaries are available on PATH. */
export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5_000 });
    await execFileAsync('ffprobe', ['-version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
