import os from 'node:os';
import path from 'node:path';

import type { MediaAsset, PipelineStage, Prisma } from '@prisma/client';

import { createAIProviders, type AIProviders } from '../../../infrastructure/ai/create-ai-providers.js';
import { AIUsageTracker } from '../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { DEFAULT_PRICING } from '../../../infrastructure/ai/usage/pricing.js';
import { silentLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import { tracePhotoImport } from '../../../infrastructure/logging/photo-import-trace.js';
import { isPhotoSourceUrl } from '../../content/providers/photo/photo-source.js';
import type { ContentVideo } from '../../content/domain/types.js';
import { parseJobOptions } from '../../jobs/domain/job-options.js';
import type { MediaAssetOrigin } from '../../media/application/media-processing.service.js';
import { sampleEvenly } from '../../media/domain/types.js';
import type { OCRResult } from '../../ocr/domain/types.js';
import { isMeaningfulTranscript } from '../../transcription/domain/transcript-quality.js';
import type { Transcript } from '../../transcription/domain/types.js';
import type { VisionAnalysis, VisionObservation } from '../../vision/domain/types.js';
import type { StageHandler, StageHandlerDeps } from './stage-orchestrator.js';

type MediaStage = Extract<
  PipelineStage,
  'PROCESSING_MEDIA' | 'TRANSCRIBING' | 'ANALYZING_FRAMES' | 'RUNNING_OCR'
>;

/** A stored frame or post image with the position needed to order evidence. */
export interface VisualAsset {
  asset: MediaAsset;
  mediaKind: 'frame' | 'image';
  slideIndex?: number;
  videoIndex: number;
  timestampSeconds?: number;
  index: number;
}

const HIGH_ACCURACY_MIN_VISION_IMAGES = 12;

/**
 * Handlers for the media stages: downloading/processing video and post images, speech-to-text
 * (or platform captions), vision analysis and OCR over frames and carousel slides.
 */
export function createMediaStageHandlers(
  deps: StageHandlerDeps,
): Record<MediaStage, StageHandler> {
  const log = deps.log ?? silentLogger();
  const cfg = deps.config.extraction;

  const aiFor = (ctx: { jobId: string; sourceUrl: string; acquiredContent?: { sourceType?: string } }): AIProviders =>
    createAIProviders(
      deps.config,
      new AIUsageTracker(deps.aiUsageRepo, DEFAULT_PRICING),
      ctx.jobId,
      log.child({
        jobId: ctx.jobId,
        ...(ctx.acquiredContent?.sourceType === 'PHOTO' || isPhotoSourceUrl(ctx.sourceUrl)
          ? { sourceType: 'PHOTO' as const }
          : {}),
      }),
    );

  return {
    PROCESSING_MEDIA: async (ctx): Promise<void> => {
      const content = ctx.acquiredContent;
      const videos: ContentVideo[] =
        content?.videos ?? (content?.videoLocalPath ? [{ localPath: content.videoLocalPath }] : []);
      const slideImages = (content?.images ?? []).flatMap((image) =>
        image.slideIndex !== undefined
          ? [
              {
                url: image.url,
                slideIndex: image.slideIndex,
                ...(image.storageKey ? { storageKey: image.storageKey } : {}),
                ...(image.mimeType ? { mimeType: image.mimeType } : {}),
              },
            ]
          : [],
      );

      if (!deps.mediaProcessing || (videos.length === 0 && slideImages.length === 0)) {
        log.info({ step: 'media.process', jobId: ctx.jobId, skipped: true }, 'media.process skipped');
        await maybeDelay(cfg.fakePipelineDelayMs);
        return;
      }

      const jobLog = log.child({ jobId: ctx.jobId });
      const tempDir = path.join(os.tmpdir(), 'recipe-extraction', ctx.jobId, 'media');
      const hasOtherEvidence = Boolean(
        content?.caption?.trim() || content?.description?.trim() || slideImages.length > 0,
      );
      let processedVideos = 0;

      for (const [videoIndex, video] of videos.entries()) {
        try {
          await deps.mediaProcessing.processVideo({
            jobId: ctx.jobId,
            videoLocalPath: video.localPath,
            tempDir,
            videoIndex,
            ...(video.slideIndex !== undefined ? { slideIndex: video.slideIndex } : {}),
          });
          processedVideos += 1;
        } catch (error: unknown) {
          const isLast = videoIndex === videos.length - 1;
          if (!hasOtherEvidence && processedVideos === 0 && isLast) {
            throw error;
          }
          jobLog.warn(
            { step: 'media.process', videoIndex, err: error },
            'media.process video failed; continuing with remaining evidence',
          );
        }
      }

      if (slideImages.length > 0) {
        const stored = await deps.mediaProcessing.processImages({
          jobId: ctx.jobId,
          images: slideImages,
        });
        tracePhoto(ctx, 'media.process-images', {
          requested: slideImages.map((image) => ({
            slideIndex: image.slideIndex,
            mimeType: image.mimeType ?? null,
            storageKey: image.storageKey ?? null,
            url: image.url,
          })),
          storedKeys: stored,
        });
        jobLog.info(
          { step: 'media.process-images', requested: slideImages.length, stored: stored.length },
          'media.process-images completed',
        );
      }
    },

    TRANSCRIBING: async (ctx): Promise<void> => {
      const jobLog = log.child({ jobId: ctx.jobId });
      const captions = ctx.acquiredContent?.captions;
      const captionTranscript: Transcript | undefined = captions
        ? {
            language: captions.language,
            fullText: captions.text,
            segments: captions.segments.map((s) => ({
              ...s,
              confidence: captions.kind === 'manual' ? 0.95 : 0.85,
            })),
            provider: { name: 'youtube-captions', kind: captions.kind },
            source: captions.kind === 'manual' ? 'manual_captions' : 'auto_captions',
          }
        : undefined;

      const audioAssets = sortByVideoIndex(
        await deps.mediaAssetRepo.findByJobAndType(ctx.jobId, 'AUDIO'),
      );

      if (captionTranscript && cfg.youtubePreferCaptions) {
        ctx.transcript = captionTranscript;
        const primaryAudio = audioAssets[0];
        if (primaryAudio && !(await deps.transcriptRepo.findByMediaAssetId(primaryAudio.id))) {
          await deps.transcriptRepo.create({
            mediaAssetId: primaryAudio.id,
            language: captionTranscript.language,
            fullText: captionTranscript.fullText,
            provider: captionTranscript.provider,
            segments: captionTranscript.segments,
          });
        }
        jobLog.info(
          { step: 'ai.transcribe', skipped: true, reason: 'platform captions', kind: captions?.kind },
          'ai.transcribe skipped',
        );
        return;
      }

      if (audioAssets.length === 0) {
        if (captionTranscript) {
          ctx.transcript = captionTranscript;
        }
        jobLog.info({ step: 'ai.transcribe', skipped: true, reason: 'no audio' }, 'ai.transcribe skipped');
        await maybeDelay(cfg.fakePipelineDelayMs);
        return;
      }

      const ai = aiFor(ctx);
      const parts: Array<{ slideIndex?: number; transcript: Transcript }> = [];

      for (const audioAsset of audioAssets) {
        const origin = readOrigin(audioAsset);
        let transcript: Transcript;

        const existing = await deps.transcriptRepo.findByMediaAssetId(audioAsset.id);
        if (existing) {
          transcript = {
            language: existing.language,
            fullText: existing.fullText,
            segments: [],
            provider: existing.provider as Prisma.InputJsonValue,
            source: 'speech',
          };
        } else {
          try {
            const audioBuffer = await deps.storage.download(audioAsset.storageKey);
            transcript = await logStep(
              jobLog,
              'ai.transcribe',
              { mimeType: audioAsset.mimeType, sizeBytes: audioBuffer.byteLength, videoIndex: origin.videoIndex },
              () => ai.transcription.transcribe({ data: audioBuffer, mimeType: audioAsset.mimeType }),
            );
          } catch (error: unknown) {
            // On-screen text may still carry the recipe; a failed transcription is not fatal.
            jobLog.warn({ step: 'ai.transcribe', err: error }, 'ai.transcribe failed; continuing');
            continue;
          }
          transcript.source = 'speech';
          await deps.transcriptRepo.create({
            mediaAssetId: audioAsset.id,
            language: transcript.language,
            fullText: transcript.fullText,
            provider: transcript.provider,
            segments: transcript.segments,
          });
        }

        if (isMeaningfulTranscript(transcript.fullText)) {
          parts.push({
            ...(origin.slideIndex !== undefined ? { slideIndex: origin.slideIndex } : {}),
            transcript,
          });
        } else {
          jobLog.info(
            { step: 'ai.transcribe', videoIndex: origin.videoIndex, chars: transcript.fullText.length },
            'ai.transcribe produced no speech (empty/music-only); excluded from evidence',
          );
        }
      }

      const merged = mergeTranscripts(parts) ?? captionTranscript;
      if (merged) {
        ctx.transcript = merged;
      }
      tracePhoto(ctx, 'ai.transcribe', {
        language: merged?.language ?? null,
        source: merged?.source ?? null,
        fullText: merged?.fullText ?? null,
        segments: merged?.segments ?? [],
        provider: merged?.provider ?? null,
      });
      jobLog.info(
        {
          step: 'ai.transcribe',
          audioTracks: audioAssets.length,
          usableTracks: parts.length,
          transcriptChars: merged?.fullText.length ?? 0,
          transcriptSource: merged?.source ?? null,
        },
        'ai.transcribe summary',
      );
    },

    ANALYZING_FRAMES: async (ctx): Promise<void> => {
      const visuals = await loadVisualAssets(deps, ctx.jobId, cfg.frameIntervalSeconds);
      if (visuals.length === 0) {
        log.info({ step: 'ai.vision', jobId: ctx.jobId, skipped: true }, 'ai.vision skipped');
        await maybeDelay(cfg.fakePipelineDelayMs);
        return;
      }

      const options =
        ctx.options ?? parseJobOptions((await deps.jobRepo.findById(ctx.jobId))?.options);
      ctx.options = options;
      const limit = options.highAccuracy
        ? Math.max(cfg.visionMaxImages, HIGH_ACCURACY_MIN_VISION_IMAGES)
        : cfg.visionMaxImages;
      const selected = sampleEvenly(visuals, limit);
      const jobLog = log.child({ jobId: ctx.jobId });
      const ai = aiFor(ctx);

      const results = await mapWithConcurrency(selected, cfg.mediaAiConcurrency, async (visual) => {
        const existing = await deps.visionRepo.findByMediaAssetId(visual.asset.id);
        if (existing[0]) {
          return {
            observations: existing[0].observations as unknown as VisionObservation[],
            provider: existing[0].provider as Record<string, unknown>,
            ...originOf(visual),
          } satisfies VisionAnalysis;
        }

        try {
          const data = await deps.storage.download(visual.asset.storageKey);
          const [analysis] = await logStep(
            jobLog,
            'ai.vision',
            { mediaKind: visual.mediaKind, slideIndex: visual.slideIndex, timestampSeconds: visual.timestampSeconds },
            () => ai.vision.analyzeImages([{ data, mimeType: visual.asset.mimeType, ...originOf(visual) }]),
          );
          if (!analysis) {
            return undefined;
          }
          await deps.visionRepo.create({
            mediaAssetId: visual.asset.id,
            observations: analysis.observations as unknown as Prisma.InputJsonValue,
            timestampSeconds: analysis.timestampSeconds ?? null,
            provider: analysis.provider as Prisma.InputJsonValue,
          });
          return analysis;
        } catch (error: unknown) {
          jobLog.warn({ step: 'ai.vision', mediaKind: visual.mediaKind, err: error }, 'ai.vision skipped image');
          tracePhotoFailure(ctx, 'ai.vision', {
            storageKey: visual.asset.storageKey,
            mediaKind: visual.mediaKind,
            slideIndex: visual.slideIndex ?? null,
          }, error);
          return undefined;
        }
      });

      ctx.visionAnalyses = results.filter((r): r is VisionAnalysis => r !== undefined);
      tracePhoto(ctx, 'ai.vision', {
        available: visuals.length,
        selected: selected.map((visual) => ({
          storageKey: visual.asset.storageKey,
          mimeType: visual.asset.mimeType,
          mediaKind: visual.mediaKind,
          slideIndex: visual.slideIndex ?? null,
          timestampSeconds: visual.timestampSeconds ?? null,
        })),
        analyses: ctx.visionAnalyses,
      });
      jobLog.info(
        {
          step: 'ai.vision',
          available: visuals.length,
          selected: selected.length,
          analysed: ctx.visionAnalyses.length,
          observations: ctx.visionAnalyses.reduce((sum, a) => sum + a.observations.length, 0),
        },
        'ai.vision summary',
      );
    },

    RUNNING_OCR: async (ctx): Promise<void> => {
      const visuals = await loadVisualAssets(deps, ctx.jobId, cfg.frameIntervalSeconds);
      if (visuals.length === 0) {
        log.info({ step: 'ai.ocr', jobId: ctx.jobId, skipped: true }, 'ai.ocr skipped');
        await maybeDelay(cfg.fakePipelineDelayMs);
        return;
      }

      const images = visuals.filter((v) => v.mediaKind === 'image').slice(0, cfg.maxPostImages);
      const frames = sampleEvenly(
        visuals.filter((v) => v.mediaKind === 'frame'),
        cfg.ocrMaxFrames,
      );
      const selected = sortVisuals([...images, ...frames]);
      const jobLog = log.child({ jobId: ctx.jobId });
      const ai = aiFor(ctx);

      const results = await mapWithConcurrency(selected, cfg.mediaAiConcurrency, async (visual) => {
        const page = {
          storageKey: visual.asset.storageKey,
          mimeType: visual.asset.mimeType,
          bytes: Number(visual.asset.sizeBytes),
          mediaKind: visual.mediaKind,
          slideIndex: visual.slideIndex ?? null,
          timestampSeconds: visual.timestampSeconds ?? null,
        };
        const existing = await deps.ocrRepo.findByMediaAssetId(visual.asset.id);
        if (existing[0]) {
          const reused = {
            text: existing[0].text,
            confidence: existing[0].confidence,
            boundingBoxes: existing[0].boundingBoxes as Prisma.InputJsonValue,
            provider: existing[0].provider as Prisma.InputJsonValue,
            ...originOf(visual),
          } satisfies OCRResult;
          tracePhoto(ctx, 'ai.ocr', {
            ...page,
            reused: true,
            text: reused.text,
            confidence: reused.confidence,
            provider: reused.provider,
          });
          return reused;
        }

        try {
          const data = await deps.storage.download(visual.asset.storageKey);
          const ocrResult = await logStep(
            jobLog,
            'ai.ocr',
            { mediaKind: visual.mediaKind, slideIndex: visual.slideIndex, timestampSeconds: visual.timestampSeconds },
            () => ai.ocr.analyzeImage({ data, mimeType: visual.asset.mimeType, ...originOf(visual) }),
          );
          await deps.ocrRepo.create({
            mediaAssetId: visual.asset.id,
            text: ocrResult.text,
            timestampSeconds: ocrResult.timestampSeconds ?? null,
            confidence: ocrResult.confidence,
            boundingBoxes: ocrResult.boundingBoxes,
            provider: ocrResult.provider,
          });
          const read = { ...ocrResult, ...originOf(visual) };
          tracePhoto(ctx, 'ai.ocr', {
            ...page,
            bytes: data.byteLength,
            text: read.text,
            confidence: read.confidence,
            boundingBoxes: read.boundingBoxes,
            provider: read.provider,
          });
          return read;
        } catch (error: unknown) {
          jobLog.warn({ step: 'ai.ocr', mediaKind: visual.mediaKind, err: error }, 'ai.ocr skipped image');
          tracePhotoFailure(ctx, 'ai.ocr', page, error);
          return undefined;
        }
      });

      ctx.ocrResults = results.filter((r): r is OCRResult => r !== undefined);
      jobLog.info(
        {
          step: 'ai.ocr',
          images: images.length,
          frames: frames.length,
          withText: ctx.ocrResults.filter((r) => r.text.trim()).length,
        },
        'ai.ocr completed',
      );
    },
  };
}

function readOrigin(asset: MediaAsset): MediaAssetOrigin {
  const meta =
    asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
      ? (asset.metadata as Record<string, unknown>)
      : {};
  const num = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const index = num(meta.index);
  const videoIndex = num(meta.videoIndex);
  const slideIndex = num(meta.slideIndex);
  const timestampSeconds = num(meta.timestampSeconds);
  return {
    ...(index !== undefined ? { index } : {}),
    ...(videoIndex !== undefined ? { videoIndex } : {}),
    ...(slideIndex !== undefined ? { slideIndex } : {}),
    ...(timestampSeconds !== undefined ? { timestampSeconds } : {}),
  };
}

function sortByVideoIndex(assets: MediaAsset[]): MediaAsset[] {
  return [...assets].sort(
    (a, b) => (readOrigin(a).videoIndex ?? 0) - (readOrigin(b).videoIndex ?? 0),
  );
}

/** Carousel order first (slide 1, 2, …), then time within a video. */
export function sortVisuals<T extends Pick<VisualAsset, 'slideIndex' | 'videoIndex' | 'timestampSeconds' | 'index'>>(
  visuals: T[],
): T[] {
  return [...visuals].sort(
    (a, b) =>
      (a.slideIndex ?? 0) - (b.slideIndex ?? 0) ||
      a.videoIndex - b.videoIndex ||
      (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0) ||
      a.index - b.index,
  );
}

async function loadVisualAssets(
  deps: StageHandlerDeps,
  jobId: string,
  frameIntervalSeconds: number,
): Promise<VisualAsset[]> {
  const [frames, images] = await Promise.all([
    deps.mediaAssetRepo.findByJobAndType(jobId, 'FRAME'),
    deps.mediaAssetRepo.findByJobAndType(jobId, 'IMAGE'),
  ]);

  const visuals: VisualAsset[] = [
    ...frames.map((asset, position) => {
      const origin = readOrigin(asset);
      const index = origin.index ?? position;
      return {
        asset,
        mediaKind: 'frame' as const,
        videoIndex: origin.videoIndex ?? 0,
        index,
        // Frames stored before timestamps were recorded fall back to index * interval.
        timestampSeconds: origin.timestampSeconds ?? index * frameIntervalSeconds,
        ...(origin.slideIndex !== undefined ? { slideIndex: origin.slideIndex } : {}),
      };
    }),
    ...images.map((asset, position) => {
      const origin = readOrigin(asset);
      return {
        asset,
        mediaKind: 'image' as const,
        videoIndex: 0,
        index: position,
        ...(origin.slideIndex !== undefined ? { slideIndex: origin.slideIndex } : {}),
      };
    }),
  ];

  return sortVisuals(visuals);
}

function tracePhoto(
  ctx: { jobId: string; sourceUrl: string; acquiredContent?: { sourceType?: string } },
  step: string,
  data: unknown,
): void {
  if (ctx.acquiredContent?.sourceType !== 'PHOTO' && !isPhotoSourceUrl(ctx.sourceUrl)) return;
  tracePhotoImport({ jobId: ctx.jobId, step, phase: 'completed', data });
}

function tracePhotoFailure(
  ctx: { jobId: string; sourceUrl: string; acquiredContent?: { sourceType?: string } },
  step: string,
  data: unknown,
  error: unknown,
): void {
  if (ctx.acquiredContent?.sourceType !== 'PHOTO' && !isPhotoSourceUrl(ctx.sourceUrl)) return;
  tracePhotoImport({ jobId: ctx.jobId, step, phase: 'failed', data, error });
}

function originOf(visual: VisualAsset): Pick<OCRResult, 'mediaKind' | 'slideIndex' | 'timestampSeconds'> {
  return {
    mediaKind: visual.mediaKind,
    ...(visual.slideIndex !== undefined ? { slideIndex: visual.slideIndex } : {}),
    ...(visual.mediaKind === 'frame' && visual.timestampSeconds !== undefined
      ? { timestampSeconds: visual.timestampSeconds }
      : {}),
  };
}

function mergeTranscripts(
  parts: Array<{ slideIndex?: number; transcript: Transcript }>,
): Transcript | undefined {
  const [first] = parts;
  if (!first) {
    return undefined;
  }
  if (parts.length === 1) {
    return first.transcript;
  }
  return {
    language: first.transcript.language,
    fullText: parts
      .map((p) =>
        p.slideIndex !== undefined
          ? `[Slide ${String(p.slideIndex)} video] ${p.transcript.fullText.trim()}`
          : p.transcript.fullText.trim(),
      )
      .join('\n\n'),
    segments: parts.flatMap((p) => p.transcript.segments),
    provider: first.transcript.provider,
    source: 'speech',
  };
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return results;
}

function maybeDelay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}