import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import { logStep } from '../../../../infrastructure/logging/log-step.js';
import { downloadMedia, type FetchLike } from '../../../../shared/utils/download-media.js';
import type {
  AcquiredContent,
  AcquisitionContext,
  ContentCaptionTrack,
  ContentProvider,
} from '../../domain/types.js';
import { buildCaptionTrack, formatChapters, selectCaptionTrack } from './youtube-captions.js';
import type { VideoDownloadClient, YtDlpMetadata } from './ytdlp-client.js';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];

export interface YouTubeProviderOptions {
  /** Set false to skip fetching captions (Whisper transcribes the audio instead). */
  fetchCaptions?: boolean;
  fetchImpl?: FetchLike;
}

export class YouTubeContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'YOUTUBE';

  constructor(
    private readonly ytdlp: VideoDownloadClient,
    private readonly options: YouTubeProviderOptions = {},
  ) {}

  supports(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return YOUTUBE_HOSTS.includes(host) || host.endsWith('.youtube.com');
    } catch {
      return false;
    }
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    const log = ctx.log;
    let metadata: YtDlpMetadata;
    try {
      metadata = log
        ? await logStep(log, 'youtube.metadata', { url }, () => this.ytdlp.fetchMetadata(url))
        : await this.ytdlp.fetchMetadata(url);
    } catch (error: unknown) {
      throw new ContentAcquisitionFailedError({
        message: error instanceof Error ? error.message : 'Failed to acquire YouTube metadata',
        cause: error,
      });
    }

    const destPath = `${ctx.tempDir}/video.mp4`;
    let videoLocalPath: string | undefined;
    let downloadError: string | undefined;
    try {
      const download = log
        ? await logStep(log, 'youtube.download', { url }, () => this.ytdlp.download(url, destPath))
        : await this.ytdlp.download(url, destPath);
      videoLocalPath = download.filePath;
    } catch (error: unknown) {
      downloadError = error instanceof Error ? error.message : 'Failed to download YouTube video';
      log?.warn({ step: 'youtube.download', url, err: error }, 'youtube.download failed');
    }

    const images = metadata.thumbnail
      ? [{ url: metadata.thumbnail, mimeType: 'image/jpeg' as const }]
      : [];
    const captions =
      this.options.fetchCaptions === false ? undefined : await this.fetchCaptions(metadata, ctx);
    const chapters = formatChapters(metadata.chapters);

    return {
      sourceType: 'YOUTUBE',
      originalUrl: url,
      normalizedUrl: metadata.webpage_url ?? url,
      ...(metadata.title ? { title: metadata.title } : {}),
      ...(metadata.description
        ? { caption: metadata.description, description: metadata.description }
        : {}),
      ...(metadata.uploader ? { author: metadata.uploader } : {}),
      ...(metadata.language ? { language: metadata.language } : {}),
      ...(videoLocalPath ? { videoLocalPath, videos: [{ localPath: videoLocalPath }] } : {}),
      ...(captions ? { captions } : {}),
      ...(metadata.thumbnail ? { thumbnailUrl: metadata.thumbnail } : {}),
      images,
      metadata: {
        provider: 'yt-dlp',
        durationSeconds: metadata.duration,
        ...(chapters.length > 0 ? { chapters } : {}),
        ...(captions ? { captionsKind: captions.kind, captionsLanguage: captions.language } : {}),
        ...(downloadError ? { downloadError } : {}),
      },
    };
  }

  /** Captions are best-effort: any failure falls back to Whisper on the downloaded audio. */
  private async fetchCaptions(
    metadata: YtDlpMetadata,
    ctx: AcquisitionContext,
  ): Promise<ContentCaptionTrack | undefined> {
    const candidate = selectCaptionTrack(metadata);
    if (!candidate) {
      return undefined;
    }
    try {
      const { data } = await downloadMedia(candidate.url, {
        maxBytes: 5 * 1024 * 1024,
        timeoutMs: 30_000,
        ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
      });
      return buildCaptionTrack(candidate, data.toString('utf8'));
    } catch (error: unknown) {
      ctx.log?.warn(
        { step: 'youtube.captions', kind: candidate.kind, language: candidate.language, err: error },
        'youtube.captions failed',
      );
      return undefined;
    }
  }
}
