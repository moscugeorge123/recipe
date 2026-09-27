import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppConfig } from '../../../config/env.js';
import type { AppLogger } from '../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import type { StorageProvider } from '../../../infrastructure/storage/storage-provider.js';
import { MediaProcessingFailedError } from '../../../shared/errors/extraction-errors.js';
import {
  downloadMedia,
  imageExtension,
  type FetchLike,
} from '../../../shared/utils/download-media.js';
import { deduplicateFramesBySignature } from '../domain/perceptual-hash.js';
import { effectiveFrameInterval, type MediaProcessor } from '../domain/types.js';
import type { IMediaAssetRepository } from '../repository/media-asset.repository.js';

export interface ProcessVideoInput {
  jobId: string;
  videoLocalPath: string;
  tempDir: string;
  /** 0 for the primary video; carousel videos after the first get their own storage prefix. */
  videoIndex?: number;
  /** 1-based carousel slide the video came from. */
  slideIndex?: number;
}

export interface ProcessVideoResult {
  /** Undefined when the video has no audio track (or audio could not be extracted). */
  audioStorageKey?: string;
  frameStorageKeys: string[];
  thumbnailStorageKey?: string;
  durationSeconds: number;
  deduplicatedFrameCount: number;
  hasAudio: boolean;
}

export interface PostImageInput {
  url: string;
  slideIndex: number;
}

export interface ProcessImagesInput {
  jobId: string;
  images: PostImageInput[];
}

/** Metadata stored on FRAME and IMAGE media assets; read back by the OCR/vision stages. */
export interface MediaAssetOrigin {
  index?: number;
  videoIndex?: number;
  slideIndex?: number;
  timestampSeconds?: number;
}

export class MediaProcessingService {
  constructor(
    private readonly processor: MediaProcessor,
    private readonly storage: StorageProvider,
    private readonly mediaAssetRepo: IMediaAssetRepository,
    private readonly config: AppConfig,
    private readonly log: AppLogger = silentLogger(),
    private readonly fetchImpl?: FetchLike,
  ) {}

  async processVideo(input: ProcessVideoInput): Promise<ProcessVideoResult> {
    const videoIndex = input.videoIndex ?? 0;
    const log = this.log.child({ jobId: input.jobId, videoIndex });
    const keyPrefix =
      videoIndex === 0 ? `jobs/${input.jobId}` : `jobs/${input.jobId}/videos/${String(videoIndex)}`;
    const origin = {
      videoIndex,
      ...(input.slideIndex !== undefined ? { slideIndex: input.slideIndex } : {}),
    };

    const metadata = await logStep(log, 'media.metadata', { path: input.videoLocalPath }, () =>
      this.processor.getMetadata(input.videoLocalPath),
    );

    if (metadata.durationSeconds > this.config.extraction.maxVideoDurationSeconds) {
      throw new MediaProcessingFailedError({
        message: `Video exceeds maximum duration of ${String(this.config.extraction.maxVideoDurationSeconds)}s`,
      });
    }

    const audioStorageKey = await this.extractAudio(input, metadata, keyPrefix, origin, log);

    const intervalSeconds = effectiveFrameInterval(
      metadata.durationSeconds,
      this.config.extraction.frameIntervalSeconds,
      this.config.extraction.maxFrames,
    );
    const framesDir = path.join(input.tempDir, `frames-${String(videoIndex)}`);
    const rawFrames = await logStep(
      log,
      'media.extract-frames',
      { intervalSeconds, maxFrames: this.config.extraction.maxFrames },
      () =>
        this.processor.extractFrames(input.videoLocalPath, {
          outputDir: framesDir,
          intervalSeconds,
          maxFrames: this.config.extraction.maxFrames,
        }),
    );

    const keptIndices = await this.dedupeFrames(rawFrames);
    log.info(
      { step: 'media.dedupe-frames', rawFrameCount: rawFrames.length, keptFrameCount: keptIndices.length },
      'media.dedupe-frames',
    );

    const frameStorageKeys: string[] = [];
    for (const [index, rawIndex] of keptIndices.entries()) {
      const framePath = rawFrames[rawIndex];
      if (!framePath) {
        continue;
      }
      const frameBuffer = await readFile(framePath);
      const frameKey = `${keyPrefix}/frames/frame-${String(index).padStart(4, '0')}.jpg`;
      const stored = await this.storage.upload(frameKey, frameBuffer, {
        contentType: 'image/jpeg',
      });
      // ffmpeg's fps filter emits output frame n at ~n * interval.
      const timestampSeconds = Math.round(rawIndex * intervalSeconds * 10) / 10;

      await this.mediaAssetRepo.create({
        jobId: input.jobId,
        assetType: 'FRAME',
        storageKey: frameKey,
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(stored.sizeBytes),
        metadata: { index, sourceFrameIndex: rawIndex, timestampSeconds, deduplicated: true, ...origin },
      });

      frameStorageKeys.push(frameKey);
    }

    const thumbnailStorageKey =
      videoIndex === 0 ? await this.storeThumbnail(input, keyPrefix, log) : undefined;

    const videoBuffer = await readFile(input.videoLocalPath);
    const videoKey = `${keyPrefix}/video.mp4`;
    const videoStored = await this.storage.upload(videoKey, videoBuffer, {
      contentType: metadata.mimeType ?? 'video/mp4',
    });

    await this.mediaAssetRepo.create({
      jobId: input.jobId,
      assetType: 'VIDEO',
      storageKey: videoKey,
      mimeType: metadata.mimeType ?? 'video/mp4',
      sizeBytes: BigInt(videoStored.sizeBytes),
      durationSeconds: Math.round(metadata.durationSeconds),
      metadata: origin,
    });

    return {
      ...(audioStorageKey ? { audioStorageKey } : {}),
      frameStorageKeys,
      ...(thumbnailStorageKey ? { thumbnailStorageKey } : {}),
      durationSeconds: metadata.durationSeconds,
      deduplicatedFrameCount: keptIndices.length,
      hasAudio: audioStorageKey !== undefined,
    };
  }

  /**
   * Downloads post images / carousel slides and stores them as IMAGE assets tagged with their
   * slide index. A failed slide is logged and skipped so the rest of the post still extracts.
   */
  async processImages(input: ProcessImagesInput): Promise<string[]> {
    const log = this.log.child({ jobId: input.jobId });
    const images = [...input.images]
      .sort((a, b) => a.slideIndex - b.slideIndex)
      .slice(0, this.config.extraction.maxPostImages);
    const keys: string[] = [];

    for (const image of images) {
      try {
        const downloaded = await logStep(
          log,
          'media.download-image',
          { slideIndex: image.slideIndex },
          () =>
            downloadMedia(image.url, {
              maxBytes: Math.min(this.config.extraction.maxMediaDownloadBytes, 25 * 1024 * 1024),
              timeoutMs: 60_000,
              acceptContentTypes: ['image/', 'application/octet-stream', 'binary/octet-stream'],
              ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
            }),
        );
        const mimeType = downloaded.contentType.startsWith('image/')
          ? downloaded.contentType
          : 'image/jpeg';
        const key = `jobs/${input.jobId}/images/slide-${String(image.slideIndex).padStart(2, '0')}.${imageExtension(mimeType)}`;
        const stored = await this.storage.upload(key, downloaded.data, { contentType: mimeType });

        await this.mediaAssetRepo.create({
          jobId: input.jobId,
          assetType: 'IMAGE',
          storageKey: key,
          mimeType,
          sizeBytes: BigInt(stored.sizeBytes),
          metadata: { slideIndex: image.slideIndex, sourceUrl: image.url },
        });
        keys.push(key);
      } catch (error: unknown) {
        log.warn(
          { step: 'media.download-image', slideIndex: image.slideIndex, err: error },
          'media.download-image failed',
        );
      }
    }

    return keys;
  }

  private async extractAudio(
    input: ProcessVideoInput,
    metadata: { hasAudio?: boolean; durationSeconds: number },
    keyPrefix: string,
    origin: Record<string, number>,
    log: AppLogger,
  ): Promise<string | undefined> {
    if (metadata.hasAudio === false) {
      log.info({ step: 'media.extract-audio', skipped: true, reason: 'no audio stream' }, 'media.extract-audio skipped');
      return undefined;
    }

    const audioPath = path.join(input.tempDir, `audio-${String(origin.videoIndex ?? 0)}.mp3`);
    let audioBuffer: Buffer;
    try {
      await logStep(log, 'media.extract-audio', {}, () =>
        this.processor.extractAudio(input.videoLocalPath, audioPath),
      );
      audioBuffer = await readFile(audioPath);
    } catch (error: unknown) {
      // Frames and OCR can still recover an on-screen recipe, so audio is not fatal.
      log.warn({ step: 'media.extract-audio', err: error }, 'media.extract-audio failed; continuing without audio');
      return undefined;
    }

    if (audioBuffer.byteLength === 0) {
      return undefined;
    }

    const audioKey = `${keyPrefix}/audio.mp3`;
    const audioStored = await this.storage.upload(audioKey, audioBuffer, {
      contentType: 'audio/mpeg',
    });

    await this.mediaAssetRepo.create({
      jobId: input.jobId,
      assetType: 'AUDIO',
      storageKey: audioKey,
      mimeType: 'audio/mpeg',
      sizeBytes: BigInt(audioStored.sizeBytes),
      durationSeconds: Math.round(metadata.durationSeconds),
      metadata: origin,
    });

    return audioKey;
  }

  private async dedupeFrames(rawFrames: string[]): Promise<number[]> {
    const signature = this.processor.computeFrameSignature?.bind(this.processor);
    if (!signature) {
      return rawFrames.map((_, index) => index);
    }
    return deduplicateFramesBySignature(rawFrames, {
      minChangedRatio: this.config.extraction.frameDedupeMinChangedRatio,
      signature,
    });
  }

  private async storeThumbnail(
    input: ProcessVideoInput,
    keyPrefix: string,
    log: AppLogger,
  ): Promise<string | undefined> {
    try {
      const thumbnailPath = path.join(input.tempDir, 'thumbnail.jpg');
      await logStep(log, 'media.thumbnail', {}, () =>
        this.processor.generateThumbnail(input.videoLocalPath, thumbnailPath),
      );
      const thumbnailBuffer = await readFile(thumbnailPath);
      const thumbnailKey = `${keyPrefix}/thumbnail.jpg`;
      const thumbStored = await this.storage.upload(thumbnailKey, thumbnailBuffer, {
        contentType: 'image/jpeg',
      });

      await this.mediaAssetRepo.create({
        jobId: input.jobId,
        assetType: 'THUMBNAIL',
        storageKey: thumbnailKey,
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(thumbStored.sizeBytes),
      });
      return thumbnailKey;
    } catch (error: unknown) {
      log.warn({ step: 'media.thumbnail', err: error }, 'media.thumbnail failed');
      return undefined;
    }
  }
}
