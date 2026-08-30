import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';
import type { VideoDownloadClient, YtDlpMetadata } from './ytdlp-client.js';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];

export class YouTubeContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'YOUTUBE';

  constructor(private readonly ytdlp: VideoDownloadClient) {}

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
    let metadata: YtDlpMetadata;
    try {
      metadata = await this.ytdlp.fetchMetadata(url);
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
      const download = await this.ytdlp.download(url, destPath);
      videoLocalPath = download.filePath;
    } catch (error: unknown) {
      downloadError = error instanceof Error ? error.message : 'Failed to download YouTube video';
    }

    const images = metadata.thumbnail
      ? [{ url: metadata.thumbnail, mimeType: 'image/jpeg' as const }]
      : [];

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
      ...(videoLocalPath ? { videoLocalPath } : {}),
      ...(metadata.thumbnail ? { thumbnailUrl: metadata.thumbnail } : {}),
      images,
      metadata: {
        provider: 'yt-dlp',
        durationSeconds: metadata.duration,
        ...(downloadError ? { downloadError } : {}),
      },
    };
  }
}
