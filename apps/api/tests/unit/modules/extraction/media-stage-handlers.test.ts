import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { AssetType, MediaAsset } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../src/config/env.js';
import type { StorageProvider } from '../../../../src/infrastructure/storage/storage-provider.js';
import type { AcquiredContent } from '../../../../src/modules/content/domain/types.js';
import { EvidenceBuilder } from '../../../../src/modules/evidence/application/evidence-builder.js';
import { createMediaStageHandlers } from '../../../../src/modules/extraction/application/media-stage-handlers.js';
import type {
  PipelineContext,
  StageHandlerDeps,
} from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import { MediaProcessingService } from '../../../../src/modules/media/application/media-processing.service.js';
import type { MediaMetadata, MediaProcessor } from '../../../../src/modules/media/domain/types.js';
import type { CreateMediaAssetInput } from '../../../../src/modules/media/repository/media-asset.repository.js';
import type { ImageInput, OCRResult } from '../../../../src/modules/ocr/domain/types.js';
import type { Transcript } from '../../../../src/modules/transcription/domain/types.js';

const aiMock = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('../../../../src/infrastructure/ai/create-ai-providers.js', () => ({
  createAIProviders: () => aiMock.current,
}));

/** Frame "pixels": a fixed-size buffer so the fake signature is comparable across frames. */
function framePixels(variant: number): Buffer {
  const pixels = Buffer.alloc(1024, 200);
  // A "text overlay" occupying ~3% of the frame, different per variant.
  pixels.fill(variant * 40, 100, 132);
  return pixels;
}

interface FakeProcessorOptions {
  metadata: MediaMetadata;
  /** One entry per sampled frame; equal numbers mean visually identical frames. */
  frameVariants: number[];
}

class FakeMediaProcessor implements MediaProcessor {
  readonly extractAudio = vi.fn(async (_input: string, outputPath: string) => {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from('fake-mp3'));
    return outputPath;
  });

  constructor(private readonly opts: FakeProcessorOptions) {}

  async extractFrames(_input: string, o: { outputDir: string }): Promise<string[]> {
    await mkdir(o.outputDir, { recursive: true });
    const paths: string[] = [];
    for (const [i, variant] of this.opts.frameVariants.entries()) {
      const p = path.join(o.outputDir, `frame-${String(i + 1).padStart(4, '0')}.jpg`);
      await writeFile(p, framePixels(variant));
      paths.push(p);
    }
    return paths;
  }

  async generateThumbnail(_input: string, outputPath: string): Promise<string> {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from('thumb'));
    return outputPath;
  }

  async getMetadata(): Promise<MediaMetadata> {
    return this.opts.metadata;
  }

  async computeFrameSignature(imagePath: string): Promise<Buffer> {
    const { readFile } = await import('node:fs/promises');
    return readFile(imagePath);
  }
}

class MemoryStorage implements StorageProvider {
  readonly files = new Map<string, Buffer>();
  async upload(key: string, data: Buffer | NodeJS.ReadableStream) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from('');
    this.files.set(key, buffer);
    return { key, sizeBytes: buffer.byteLength, contentType: 'application/octet-stream' };
  }
  async download(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`missing ${key}`);
    }
    return file;
  }
  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
  async getSignedUrl(key: string): Promise<string> {
    return `memory://${key}`;
  }
}

class MemoryMediaAssetRepo {
  readonly assets: MediaAsset[] = [];
  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const asset: MediaAsset = {
      id: randomUUID(),
      jobId: input.jobId,
      assetType: input.assetType,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      durationSeconds: input.durationSeconds ?? null,
      metadata: (input.metadata ?? {}) as MediaAsset['metadata'],
      expiresAt: null,
      createdAt: new Date(Date.now() + this.assets.length),
    };
    this.assets.push(asset);
    return asset;
  }
  async findByJobAndType(jobId: string, type: AssetType): Promise<MediaAsset[]> {
    return this.assets.filter((a) => a.jobId === jobId && a.assetType === type);
  }
  async findByJobId(jobId: string): Promise<MediaAsset[]> {
    return this.assets.filter((a) => a.jobId === jobId);
  }
}

/** OCR mock that "reads" the text registered for each image's bytes. */
function createAi(textByContent: Map<string, string>, transcript?: Partial<Transcript>) {
  const ocrCalls: ImageInput[] = [];
  const transcribe = vi.fn(async (): Promise<Transcript> => ({
    language: 'en',
    fullText: '',
    segments: [],
    provider: { name: 'mock' },
    ...transcript,
  }));
  const ai = {
    llm: {},
    transcription: { transcribe },
    ocr: {
      analyzeImage: vi.fn(async (image: ImageInput): Promise<OCRResult> => {
        ocrCalls.push(image);
        return {
          text: textByContent.get(image.data.toString('base64')) ?? '',
          confidence: 0.9,
          boundingBoxes: [],
          provider: { name: 'mock-ocr' },
          ...(image.timestampSeconds !== undefined ? { timestampSeconds: image.timestampSeconds } : {}),
          ...(image.mediaKind ? { mediaKind: image.mediaKind } : {}),
          ...(image.slideIndex !== undefined ? { slideIndex: image.slideIndex } : {}),
        };
      }),
    },
    vision: {
      analyzeImages: vi.fn(async (images: ImageInput[]) =>
        images.map((image) => ({
          observations: [{ type: 'dish', description: 'plated food', confidence: 0.6 }],
          provider: { name: 'mock-vision' },
          ...(image.mediaKind ? { mediaKind: image.mediaKind } : {}),
          ...(image.slideIndex !== undefined ? { slideIndex: image.slideIndex } : {}),
          ...(image.timestampSeconds !== undefined ? { timestampSeconds: image.timestampSeconds } : {}),
        })),
      ),
    },
  };
  aiMock.current = ai;
  return { ai, ocrCalls, transcribe };
}

function imageFetch(bodies: Map<string, Buffer>) {
  return vi.fn(async (url: string) => {
    const body = bodies.get(url);
    if (!body) {
      return new Response('not found', { status: 404 });
    }
    return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  });
}

describe('media stage handlers', () => {
  let tempDir: string;
  let videoPath: string;
  const jobId = randomUUID();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'media-stages-'));
    videoPath = path.join(tempDir, 'video.mp4');
    await writeFile(videoPath, Buffer.from('fake-video'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    await rm(path.join(os.tmpdir(), 'recipe-extraction', jobId), { recursive: true, force: true });
  });

  function setup(opts: {
    processor?: FakeMediaProcessor;
    fetchImpl?: ReturnType<typeof imageFetch>;
    env?: Record<string, string>;
  }) {
    const config = loadConfig({ NODE_ENV: 'test', ...opts.env });
    const storage = new MemoryStorage();
    const mediaAssetRepo = new MemoryMediaAssetRepo();
    const ocrRows: unknown[] = [];
    const transcriptRows: Array<{ fullText: string; provider: unknown }> = [];
    const processor =
      opts.processor ??
      new FakeMediaProcessor({ metadata: { durationSeconds: 1, hasAudio: false }, frameVariants: [] });
    const mediaProcessing = new MediaProcessingService(
      processor,
      storage,
      mediaAssetRepo,
      config,
      undefined,
      opts.fetchImpl,
    );
    const deps = {
      mediaProcessing,
      mediaAssetRepo,
      storage,
      config,
      jobRepo: { findById: async () => ({ options: {} }) },
      transcriptRepo: {
        findByMediaAssetId: async () => null,
        create: async (row: { fullText: string; provider: unknown }) => {
          transcriptRows.push(row);
          return row;
        },
      },
      ocrRepo: {
        findByMediaAssetId: async () => [],
        create: async (row: unknown) => {
          ocrRows.push(row);
          return row;
        },
      },
      visionRepo: { findByMediaAssetId: async () => [], create: async (row: unknown) => row },
      aiUsageRepo: { create: async () => ({}) },
    } as unknown as StageHandlerDeps;
    return { handlers: createMediaStageHandlers(deps), storage, mediaAssetRepo, ocrRows, transcriptRows };
  }

  async function runMediaStages(
    handlers: ReturnType<typeof createMediaStageHandlers>,
    acquiredContent: AcquiredContent,
  ): Promise<PipelineContext> {
    const ctx: PipelineContext = { jobId, sourceUrl: acquiredContent.originalUrl, outputLanguage: 'en', acquiredContent };
    await handlers.PROCESSING_MEDIA(ctx);
    await handlers.TRANSCRIBING(ctx);
    await handlers.ANALYZING_FRAMES(ctx);
    await handlers.RUNNING_OCR(ctx);
    return ctx;
  }

  function promptFor(ctx: PipelineContext): string {
    const builder = new EvidenceBuilder();
    return builder.formatForPrompt(
      builder.build({
        ...(ctx.acquiredContent ? { acquiredContent: ctx.acquiredContent } : {}),
        ...(ctx.transcript ? { transcript: ctx.transcript } : {}),
        ...(ctx.ocrResults ? { ocrResults: ctx.ocrResults } : {}),
        ...(ctx.visionAnalyses ? { visionAnalyses: ctx.visionAnalyses } : {}),
      }),
    );
  }

  it('OCRs every slide of a 5-image carousel in slide order', async () => {
    const slideTexts = [
      'Lemon Garlic Pasta',
      'Ingredients:\n200 g spaghetti\n3 cloves garlic',
      '1 lemon (zest + juice)\n2 tbsp olive oil',
      '1. Boil pasta 9 min\n2. Sizzle garlic in oil',
      '3. Toss with lemon and pasta water. Serves 2',
    ];
    const bodies = new Map<string, Buffer>();
    const textByContent = new Map<string, string>();
    slideTexts.forEach((text, i) => {
      const body = Buffer.from(`slide-${String(i + 1)}-jpeg`);
      bodies.set(`https://cdn.example/slide-${String(i + 1)}.jpg`, body);
      textByContent.set(body.toString('base64'), text);
    });
    const { ocrCalls, transcribe } = createAi(textByContent);
    const { handlers, mediaAssetRepo } = setup({ fetchImpl: imageFetch(bodies) });

    // Deliberately out of order: slide order must come from slideIndex, not array order.
    const images = [3, 1, 5, 2, 4].map((n) => ({
      url: `https://cdn.example/slide-${String(n)}.jpg`,
      slideIndex: n,
    }));
    const ctx = await runMediaStages(handlers, {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/p/carousel/',
      normalizedUrl: 'https://www.instagram.com/p/carousel/',
      images,
      metadata: {},
    });

    expect(mediaAssetRepo.assets.filter((a) => a.assetType === 'IMAGE')).toHaveLength(5);
    expect(ocrCalls.map((c) => c.slideIndex)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    expect(ctx.ocrResults?.map((r) => r.slideIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(transcribe).not.toHaveBeenCalled();

    const prompt = promptFor(ctx);
    const positions = [1, 2, 3, 4, 5].map((n) => prompt.indexOf(`[Slide ${String(n)} OCR]`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(prompt).toContain('200 g spaghetti');
    expect(prompt).toContain('Serves 2');
  });

  it('handles a mixed carousel: image slides plus a video slide with speech and overlays', async () => {
    const bodies = new Map<string, Buffer>([
      ['https://cdn.example/a.jpg', Buffer.from('slide-1-jpeg')],
      ['https://cdn.example/c.jpg', Buffer.from('slide-3-jpeg')],
    ]);
    const textByContent = new Map<string, string>([
      [Buffer.from('slide-1-jpeg').toString('base64'), 'Banana Bread'],
      [Buffer.from('slide-3-jpeg').toString('base64'), 'Bake 350°F for 55 min'],
      [framePixels(1).toString('base64'), '3 ripe bananas'],
      [framePixels(2).toString('base64'), '2 cups flour'],
    ]);
    const { transcribe } = createAi(textByContent, {
      fullText: 'Mash the bananas, then fold in the flour and a pinch of salt.',
    });
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 4, hasAudio: true },
      frameVariants: [1, 1, 2, 2],
    });
    const { handlers, mediaAssetRepo } = setup({ processor, fetchImpl: imageFetch(bodies) });

    const ctx = await runMediaStages(handlers, {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/p/mixed/',
      normalizedUrl: 'https://www.instagram.com/p/mixed/',
      caption: 'Best banana bread',
      videoLocalPath: videoPath,
      videos: [{ localPath: videoPath, slideIndex: 2 }],
      images: [
        { url: 'https://cdn.example/a.jpg', slideIndex: 1 },
        { url: 'https://cdn.example/c.jpg', slideIndex: 3 },
      ],
      metadata: {},
    });

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(ctx.transcript?.fullText).toContain('Mash the bananas');
    const frames = mediaAssetRepo.assets.filter((a) => a.assetType === 'FRAME');
    expect(frames).toHaveLength(2);
    expect(frames.map((f) => (f.metadata as { slideIndex?: number }).slideIndex)).toEqual([2, 2]);

    const ocrOrder = (ctx.ocrResults ?? []).map((r) => `${r.mediaKind ?? ''}:${String(r.slideIndex)}`);
    expect(ocrOrder).toEqual(['image:1', 'frame:2', 'frame:2', 'image:3']);

    const prompt = promptFor(ctx);
    const order = ['[Slide 1 OCR]', '[Slide 2 video @0s OCR]', '[Slide 2 video @2s OCR]', '[Slide 3 OCR]'].map(
      (label) => prompt.indexOf(label),
    );
    expect(order.every((p) => p >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(prompt).toContain('Transcript (spoken audio, speech-to-text)');
  });

  it('extracts on-screen text from a silent video without failing on the missing audio track', async () => {
    const textByContent = new Map<string, string>([
      [framePixels(1).toString('base64'), 'Overnight oats'],
      [framePixels(2).toString('base64'), '1/2 cup oats'],
      [framePixels(3).toString('base64'), '1/2 cup oats\n1/2 cup milk'],
      [framePixels(4).toString('base64'), 'Refrigerate 8 hours'],
    ]);
    const { ocrCalls, transcribe } = createAi(textByContent);
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 8, hasAudio: false },
      // Frames differ only by their text overlay; repeats are true duplicates.
      frameVariants: [1, 1, 2, 3, 3, 4, 4, 4],
    });
    processor.extractAudio.mockRejectedValue(new Error('Output file does not contain any stream'));
    const { handlers, mediaAssetRepo } = setup({ processor });

    const ctx = await runMediaStages(handlers, {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/reel/silent/',
      normalizedUrl: 'https://www.instagram.com/reel/silent/',
      videoLocalPath: videoPath,
      images: [],
      metadata: {},
    });

    expect(processor.extractAudio).not.toHaveBeenCalled();
    expect(mediaAssetRepo.assets.some((a) => a.assetType === 'AUDIO')).toBe(false);
    expect(transcribe).not.toHaveBeenCalled();
    expect(ctx.transcript).toBeUndefined();

    const frames = mediaAssetRepo.assets.filter((a) => a.assetType === 'FRAME');
    expect(frames.map((f) => (f.metadata as { timestampSeconds: number }).timestampSeconds)).toEqual([0, 2, 3, 5]);
    expect(ocrCalls).toHaveLength(4);

    const prompt = promptFor(ctx);
    expect(prompt).toContain('[Frame @0s OCR] Overnight oats');
    // The progressively revealed overlay is kept once, in its fullest form.
    expect(prompt).toContain('1/2 cup milk');
    expect(prompt.match(/1\/2 cup oats/g)).toHaveLength(1);
    expect(prompt).toContain('Refrigerate 8 hours');
  });

  it('continues when audio extraction fails even though ffprobe reported an audio stream', async () => {
    createAi(new Map([[framePixels(1).toString('base64'), 'Step 1']]));
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 2, hasAudio: true },
      frameVariants: [1],
    });
    processor.extractAudio.mockRejectedValue(new Error('ffmpeg exited with code 234'));
    const { handlers } = setup({ processor });

    const ctx = await runMediaStages(handlers, {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/reel/broken-audio/',
      normalizedUrl: 'https://www.instagram.com/reel/broken-audio/',
      videoLocalPath: videoPath,
      images: [],
      metadata: {},
    });

    expect(ctx.ocrResults?.[0]?.text).toBe('Step 1');
  });

  it('drops a music-only Whisper transcript but keeps OCR', async () => {
    const { transcribe } = createAi(new Map([[framePixels(1).toString('base64'), '2 eggs']]), {
      fullText: '♪ [Music] ♪ Thank you for watching!',
    });
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 2, hasAudio: true },
      frameVariants: [1],
    });
    const { handlers, transcriptRows } = setup({ processor });

    const ctx = await runMediaStages(handlers, {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/reel/music/',
      normalizedUrl: 'https://www.instagram.com/reel/music/',
      videoLocalPath: videoPath,
      images: [],
      metadata: {},
    });

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcriptRows).toHaveLength(1);
    expect(ctx.transcript).toBeUndefined();
    expect(promptFor(ctx)).not.toContain('Transcript');
    expect(ctx.ocrResults?.[0]?.text).toBe('2 eggs');
  });

  it('uses YouTube subtitles as the transcript instead of calling Whisper', async () => {
    const { transcribe } = createAi(new Map());
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 2, hasAudio: true },
      frameVariants: [1],
    });
    const { handlers, transcriptRows } = setup({ processor });

    const ctx = await runMediaStages(handlers, {
      sourceType: 'YOUTUBE',
      originalUrl: 'https://www.youtube.com/watch?v=abc',
      normalizedUrl: 'https://www.youtube.com/watch?v=abc',
      title: 'Carbonara',
      videoLocalPath: videoPath,
      videos: [{ localPath: videoPath }],
      captions: {
        kind: 'manual',
        language: 'en',
        text: 'Whisk three egg yolks with 50 grams of pecorino.',
        segments: [{ startSeconds: 0, endSeconds: 3, text: 'Whisk three egg yolks with 50 grams of pecorino.' }],
      },
      images: [],
      metadata: { chapters: ['0:00 Ingredients', '1:10 Sauce'] },
    });

    expect(transcribe).not.toHaveBeenCalled();
    expect(ctx.transcript?.source).toBe('manual_captions');
    expect(transcriptRows[0]?.provider).toMatchObject({ name: 'youtube-captions' });

    const prompt = promptFor(ctx);
    expect(prompt).toContain('Transcript (uploader subtitles)');
    expect(prompt).toContain('50 grams of pecorino');
    expect(prompt).toContain('1:10 Sauce');
  });

  it('falls back to Whisper when YOUTUBE_PREFER_CAPTIONS=false', async () => {
    const { transcribe } = createAi(new Map(), { fullText: 'Whisper heard the chef say add the guanciale now.' });
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 2, hasAudio: true },
      frameVariants: [1],
    });
    const { handlers } = setup({ processor, env: { YOUTUBE_PREFER_CAPTIONS: 'false' } });

    const ctx = await runMediaStages(handlers, {
      sourceType: 'YOUTUBE',
      originalUrl: 'https://www.youtube.com/watch?v=abc',
      normalizedUrl: 'https://www.youtube.com/watch?v=abc',
      videoLocalPath: videoPath,
      captions: { kind: 'auto', language: 'en', text: 'auto captions text here', segments: [] },
      images: [],
      metadata: {},
    });

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(ctx.transcript?.fullText).toContain('guanciale');
  });

  it('samples OCR frames evenly across a long video instead of only the first few', async () => {
    const variants = Array.from({ length: 40 }, (_, i) => i + 1);
    const textByContent = new Map(variants.map((v) => [framePixels(v).toString('base64'), `overlay ${String(v)}`]));
    const { ocrCalls } = createAi(textByContent);
    const processor = new FakeMediaProcessor({
      metadata: { durationSeconds: 40, hasAudio: false },
      frameVariants: variants,
    });
    const { handlers } = setup({ processor, env: { OCR_MAX_FRAMES: '5' } });

    await runMediaStages(handlers, {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/reel/long/',
      normalizedUrl: 'https://www.instagram.com/reel/long/',
      videoLocalPath: videoPath,
      images: [],
      metadata: {},
    });

    const stamps = ocrCalls.map((c) => c.timestampSeconds ?? -1).sort((a, b) => a - b);
    expect(stamps).toHaveLength(5);
    expect(stamps[0]).toBe(0);
    expect(stamps[4]).toBe(39);
  });
});
