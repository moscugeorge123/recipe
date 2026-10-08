import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LocalStorageProvider } from '../../../src/infrastructure/storage/local/local-storage-provider.js';
import { PrismaMediaAssetRepository } from '../../../src/infrastructure/database/repositories/media-asset.repository.js';
import { isFfmpegAvailable, FfmpegMediaProcessor } from '../../../src/modules/media/ffmpeg/ffmpeg-media-processor.js';
import { MediaProcessingService } from '../../../src/modules/media/application/media-processing.service.js';
import { loadConfig } from '../../../src/config/env.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const execFileAsync = promisify(execFile);

const ffmpegAvailable = await isFfmpegAvailable();
const dbAvailable = await isDatabaseAvailable();

async function createTestVideo(outputPath: string): Promise<void> {
  await execFileAsync(
    'ffmpeg',
    [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=4:size=320x240:rate=1',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=4',
      '-shortest',
      '-y',
      outputPath,
    ],
    { timeout: 30_000 },
  );
}

describe.skipIf(!ffmpegAvailable || !dbAvailable)('media processing integration', () => {
  const prisma = getTestPrisma();
  let tempDir: string;
  let storageDir: string;
  let videoPath: string;
  const jobId = '00000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    await resetDatabase(prisma);
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'media-test-'));
    storageDir = path.join(tempDir, 'storage');
    videoPath = path.join(tempDir, 'sample.mp4');
    await createTestVideo(videoPath);

    await prisma.recipeSource.create({
      data: {
        id: '00000000-0000-4000-8000-000000000010',
        sourceType: 'YOUTUBE',
        originalUrl: 'https://youtube.com/watch?v=test',
        normalizedUrl: 'https://youtube.com/watch?v=test',
        urlHash: 'media-test-hash',
      },
    });

    await prisma.extractionJob.create({
      data: {
        id: jobId,
        recipeSourceId: '00000000-0000-4000-8000-000000000010',
        outputLanguage: 'en',
      },
    });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
    await disconnectTestDatabase();
  });

  it('extracts audio, frames, thumbnail and stores artifacts', async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      FRAME_INTERVAL_SECONDS: '2',
      MAX_FRAMES: '10',
    });

    const storage = new LocalStorageProvider(storageDir);
    const mediaAssetRepo = new PrismaMediaAssetRepository(prisma);
    const service = new MediaProcessingService(
      new FfmpegMediaProcessor(),
      storage,
      mediaAssetRepo,
      config,
    );

    const result = await service.processVideo({
      jobId,
      videoLocalPath: videoPath,
      tempDir: path.join(tempDir, 'processing'),
    });

    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(result.frameStorageKeys.length).toBeGreaterThan(0);
    expect(result.deduplicatedFrameCount).toBeGreaterThan(0);

    expect(result.hasAudio).toBe(true);
    const audio = await storage.download(result.audioStorageKey ?? '');
    expect(audio.byteLength).toBeGreaterThan(0);

    const thumbnail = await storage.download(result.thumbnailStorageKey ?? '');
    expect(thumbnail.byteLength).toBeGreaterThan(0);

    const assets = await mediaAssetRepo.findByJobId(jobId);
    const types = assets.map((a) => a.assetType).sort();
    expect(types).toContain('AUDIO');
    expect(types).toContain('VIDEO');
    expect(types).toContain('THUMBNAIL');
    expect(types.filter((t) => t === 'FRAME').length).toBe(result.deduplicatedFrameCount);
  });
});

describe.skipIf(!ffmpegAvailable)('silent text-overlay video (no database)', () => {
  let tempDir: string;
  let videoPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'silent-video-'));
    videoPath = path.join(tempDir, 'silent.mp4');
    // No audio stream; a small "caption" box alternates position every 2s on a static background,
    // the way recipe reels swap text overlays.
    await execFileAsync(
      'ffmpeg',
      [
        '-f', 'lavfi',
        '-i', 'color=c=orange:s=360x640:d=8:r=10',
        '-vf',
        "drawbox=x=30:y=300:w=60:h=20:color=black:t=fill:enable='lt(mod(t,4),2)',drawbox=x=150:y=400:w=60:h=20:color=black:t=fill:enable='gte(mod(t,4),2)'",
        '-pix_fmt', 'yuv420p',
        '-y', videoPath,
      ],
      { timeout: 30_000 },
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('skips audio, keeps every distinct overlay frame and records timestamps', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FRAME_INTERVAL_SECONDS: '1',
      MAX_FRAMES: '50',
    });
    const assets: Array<{ assetType: string; metadata?: unknown }> = [];
    const repo = {
      create: async (input: { assetType: string; metadata?: unknown }) => {
        assets.push(input);
        return input as never;
      },
      findByJobAndType: async () => [],
      findByJobId: async () => [],
    };
    const service = new MediaProcessingService(
      new FfmpegMediaProcessor(),
      new LocalStorageProvider(path.join(tempDir, 'storage')),
      repo,
      config,
    );

    const result = await service.processVideo({
      jobId: '00000000-0000-4000-8000-0000000000aa',
      videoLocalPath: videoPath,
      tempDir: path.join(tempDir, 'processing'),
    });

    expect(result.hasAudio).toBe(false);
    expect(result.audioStorageKey).toBeUndefined();
    expect(assets.some((a) => a.assetType === 'AUDIO')).toBe(false);
    // 8 sampled frames alternate between two overlays every 2s -> 4 distinct segments kept.
    expect(result.deduplicatedFrameCount).toBe(4);
    const stamps = assets
      .filter((a) => a.assetType === 'FRAME')
      .map((a) => (a.metadata as { timestampSeconds: number }).timestampSeconds);
    expect(stamps).toEqual([0, 2, 4, 6]);
  });
});

describe.skipIf(!ffmpegAvailable)('FfmpegMediaProcessor', () => {
  let tempDir: string;
  let videoPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'ffmpeg-unit-'));
    videoPath = path.join(tempDir, 'short.mp4');
    await createTestVideo(videoPath);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads metadata from a video file', async () => {
    const processor = new FfmpegMediaProcessor();
    const metadata = await processor.getMetadata(videoPath);

    expect(metadata.durationSeconds).toBeGreaterThan(0);
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(240);
  });

  it('extracts frames at the configured interval', async () => {
    const processor = new FfmpegMediaProcessor();
    const framesDir = path.join(tempDir, 'frames-out');
    const frames = await processor.extractFrames(videoPath, {
      outputDir: framesDir,
      intervalSeconds: 2,
      maxFrames: 5,
    });

    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      const content = await readFile(frame);
      expect(content.byteLength).toBeGreaterThan(0);
    }
  });
});
