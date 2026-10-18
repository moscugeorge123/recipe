import type { SourceType } from '@prisma/client';

export interface LinkPreviewThumbnail {
  url: string;
}

export interface LinkPreview {
  url: string;
  sourceType: SourceType;
  title: string | null;
  author: string | null;
  description: string | null;
  thumbnails: LinkPreviewThumbnail[];
  /** The site refused the preview request; importing may still work through the fallback. */
  blocked?: boolean;
}

export interface LinkUnfurler {
  supports(url: string): boolean;
  unfurl(url: string): Promise<LinkPreview>;
}
