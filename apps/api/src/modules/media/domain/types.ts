export interface MediaMetadata {
  durationSeconds: number;
  width?: number;
  height?: number;
  codec?: string;
  mimeType?: string;
  /** False when the container has no audio stream (silent reels, slideshow videos). */
  hasAudio?: boolean;
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
  /**
   * Decoded, downscaled grayscale pixels of an image (fixed size for every frame), used to
   * detect near-duplicate frames. Optional: without it frames are not deduplicated.
   */
  computeFrameSignature?(imagePath: string): Promise<Buffer>;
}

/**
 * Sampling interval that spreads `maxFrames` over the whole video instead of stopping after
 * `maxFrames * minInterval` seconds.
 */
export function effectiveFrameInterval(
  durationSeconds: number,
  minIntervalSeconds: number,
  maxFrames: number,
): number {
  if (durationSeconds <= 0 || maxFrames <= 0) {
    return minIntervalSeconds;
  }
  return Math.max(minIntervalSeconds, durationSeconds / maxFrames);
}

/** Picks `count` items spread evenly across the list, always keeping the first and last. */
export function sampleEvenly<T>(items: readonly T[], count: number): T[] {
  if (count <= 0) {
    return [];
  }
  if (items.length <= count) {
    return [...items];
  }
  if (count === 1) {
    return [items[0] as T];
  }
  const step = (items.length - 1) / (count - 1);
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.round(i * step)] as T);
  }
  return picked;
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
