import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppConfig } from '../../../config/env.js';
import type { StorageProvider } from '../../../infrastructure/storage/storage-provider.js';
import { MediaProcessingFailedError } from '../../../shared/errors/extraction-errors.js';
import { deduplicateFrames } from '../domain/perceptual-hash.js';
import type { MediaProcessor } from '../domain/types.js';
import type { IMediaAssetRepository } from '../repository/media-asset.repository.js';

export interface ProcessVideoInput {
  jobId: string;
  videoLocalPath: string;
  tempDir: string;
}

export interface ProcessVideoResult {
  audioStorageKey: string;
  frameStorageKeys: string[];
  thumbnailStorageKey: string;
  durationSeconds: number;
  deduplicatedFrameCount: number;
}

export class MediaProcessingService {
  constructor(
    private readonly processor: MediaProcessor,
    private readonly storage: StorageProvider,
    private readonly mediaAssetRepo: IMediaAssetRepository,
    private readonly config: AppConfig,
  ) {}

  async processVideo(input: ProcessVideoInput): Promise<ProcessVideoResult> {
    const metadata = await this.processor.getMetadata(input.videoLocalPath);

    if (metadata.durationSeconds > this.config.extraction.maxVideoDurationSeconds) {
      throw new MediaProcessingFailedError({
        message: `Video exceeds maximum duration of ${String(this.config.extraction.maxVideoDurationSeconds)}s`,
      });
    }

    const audioPath = path.join(input.tempDir, 'audio.mp3');
    await this.processor.extractAudio(input.videoLocalPath, audioPath);
    const audioBuffer = await readFile(audioPath);
    const audioKey = `jobs/${input.jobId}/audio.mp3`;
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
    });

    const framesDir = path.join(input.tempDir, 'frames');
    const rawFrames = await this.processor.extractFrames(input.videoLocalPath, {
      outputDir: framesDir,
      intervalSeconds: this.config.extraction.frameIntervalSeconds,
      maxFrames: this.config.extraction.maxFrames,
    });

    const uniqueFrames = await deduplicateFrames(rawFrames);
    const frameStorageKeys: string[] = [];

    for (const [index, framePath] of uniqueFrames.entries()) {
      const frameBuffer = await readFile(framePath);
      const frameKey = `jobs/${input.jobId}/frames/frame-${String(index).padStart(4, '0')}.jpg`;
      const stored = await this.storage.upload(frameKey, frameBuffer, {
        contentType: 'image/jpeg',
      });

      await this.mediaAssetRepo.create({
        jobId: input.jobId,
        assetType: 'FRAME',
        storageKey: frameKey,
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(stored.sizeBytes),
        metadata: { index, deduplicated: true },
      });

      frameStorageKeys.push(frameKey);
    }

    const thumbnailPath = path.join(input.tempDir, 'thumbnail.jpg');
    await this.processor.generateThumbnail(input.videoLocalPath, thumbnailPath);
    const thumbnailBuffer = await readFile(thumbnailPath);
    const thumbnailKey = `jobs/${input.jobId}/thumbnail.jpg`;
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

    const videoBuffer = await readFile(input.videoLocalPath);
    const videoKey = `jobs/${input.jobId}/video.mp4`;
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
    });

    return {
      audioStorageKey: audioKey,
      frameStorageKeys,
      thumbnailStorageKey: thumbnailKey,
      durationSeconds: metadata.durationSeconds,
      deduplicatedFrameCount: uniqueFrames.length,
    };
  }
}
