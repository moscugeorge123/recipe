import type { ApifyInstagramPost } from './apify-client.js';

export interface InstagramSlide {
  /** 1-based position in the post. */
  slideIndex: number;
  kind: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
}

/**
 * Flattens an Apify Instagram item into ordered slides. Handles single images, single videos
 * (reels) and carousels (`type: Sidecar`), where slides come from `childPosts` (preferred, since
 * it distinguishes video children) or, in older/lighter payloads, `carouselImages` / `images`.
 */
export function extractInstagramSlides(post: ApifyInstagramPost): InstagramSlide[] {
  const children = (post.childPosts ?? []).filter(
    (child) => child.videoUrl || child.displayUrl || child.images?.[0],
  );

  if (children.length > 0) {
    return children.map((child, index) => {
      const imageUrl = child.displayUrl ?? child.images?.[0];
      if (child.videoUrl) {
        return {
          slideIndex: index + 1,
          kind: 'video' as const,
          videoUrl: child.videoUrl,
          ...(imageUrl ? { imageUrl } : {}),
        };
      }
      return { slideIndex: index + 1, kind: 'image' as const, ...(imageUrl ? { imageUrl } : {}) };
    });
  }

  const carouselUrls = uniqueUrls(
    post.carouselImages && post.carouselImages.length > 0 ? post.carouselImages : (post.images ?? []),
  );
  const isCarousel = post.type === 'Sidecar' || (!post.videoUrl && carouselUrls.length > 1);

  if (isCarousel && carouselUrls.length > 0) {
    return carouselUrls.map((imageUrl, index) => ({
      slideIndex: index + 1,
      kind: 'image' as const,
      imageUrl,
    }));
  }

  if (post.videoUrl) {
    const cover = post.displayUrl ?? post.images?.[0];
    return [
      { slideIndex: 1, kind: 'video', videoUrl: post.videoUrl, ...(cover ? { imageUrl: cover } : {}) },
    ];
  }

  const imageUrl = post.displayUrl ?? carouselUrls[0];
  return imageUrl ? [{ slideIndex: 1, kind: 'image', imageUrl }] : [];
}

function uniqueUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}
