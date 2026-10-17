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
  /**
   * Web pages only: whether the page reads like a food recipe. `null` when it could not be
   * judged; absent for platforms (Instagram, YouTube) where the importer decides.
   */
  looksLikeRecipe?: boolean | null;
}

export interface LinkUnfurler {
  supports(url: string): boolean;
  unfurl(url: string): Promise<LinkPreview>;
}
