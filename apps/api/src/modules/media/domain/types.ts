export interface MediaMetadata {
  durationSeconds: number;
  width?: number;
  height?: number;
  codec?: string;
  mimeType?: string;
}

export interface FrameExtractionOptions {
  outputDir: string;
  intervalSeconds: number;
  maxFrames?: number;
}

export interface MediaProcessor {
  extractAudio(inputPath: string, outputPath: string): Promise<string>;
  extractFrames(inputPath: string, opts: FrameExtractionOptions): Promise<string[]>;
  generateThumbnail(inputPath: string, outputPath: string): Promise<string>;
  getMetadata(inputPath: string): Promise<MediaMetadata>;
}

export interface FrameStrategyOptions {
  intervalSeconds: number;
  maxFrames: number;
  maxDurationSeconds: number;
}

/** Computes frame timestamps at a fixed interval, capped by duration and count limits. */
export function computeFrameTimestamps(
  durationSeconds: number,
  opts: FrameStrategyOptions,
): number[] {
  const cappedDuration = Math.min(durationSeconds, opts.maxDurationSeconds);
  const timestamps: number[] = [];

  for (let t = 0; t < cappedDuration; t += opts.intervalSeconds) {
    timestamps.push(t);
    if (timestamps.length >= opts.maxFrames) {
      break;
    }
  }

  if (timestamps.length === 0 && cappedDuration > 0) {
    timestamps.push(0);
  }

  return timestamps;
}
