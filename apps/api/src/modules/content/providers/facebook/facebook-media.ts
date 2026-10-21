import type { ApifyFacebookMedia, ApifyFacebookPost } from './apify-facebook-client.js';

const FACEBOOK_HOSTS = ['facebook.com', 'fb.com', 'fb.watch'];

export function isFacebookHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return FACEBOOK_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

const VIDEO_PATH = /^\/(?:reels?|watch|videos?|video\.php|share\/[rv]|[^/]+\/videos)(?:\/|$|\?)/i;

/** Reels, watch pages and video posts: yt-dlp can read these even when the post scraper cannot. */
export function looksLikeFacebookVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'fb.watch') return true;
    return VIDEO_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isVideoMedia(item: ApifyFacebookMedia): boolean {
  return (item.__typename ?? '').toLowerCase().includes('video') || videoUrlOf(item) !== undefined;
}

function videoUrlOf(item: ApifyFacebookMedia): string | undefined {
  return firstHttp(
    item.browser_native_hd_url,
    item.video_url,
    item.videoUrl,
    item.playable_url,
    item.browser_native_sd_url,
  );
}

function firstHttp(...values: Array<string | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value));
}

export interface FacebookMedia {
  /** Photo URLs in post order. */
  photos: string[];
  /** Direct video URLs the actor exposed, if any. */
  videoUrls: string[];
  /** The post holds a video, whether or not a direct URL came back. */
  hasVideo: boolean;
  /** A cover image for previews. */
  poster?: string;
}

export function extractFacebookMedia(post: ApifyFacebookPost): FacebookMedia {
  const photos: string[] = [];
  const videoUrls: string[] = [];
  let hasVideo = false;
  let poster: string | undefined;

  for (const item of post.media ?? []) {
    if (isVideoMedia(item)) {
      hasVideo = true;
      const direct = videoUrlOf(item);
      if (direct && !videoUrls.includes(direct)) videoUrls.push(direct);
      poster ??= firstHttp(item.thumbnail);
      continue;
    }
    const photo = firstHttp(item.photo_image?.uri, item.image?.uri, item.thumbnail);
    if (photo && !photos.includes(photo)) photos.push(photo);
  }

  return { photos, videoUrls, hasVideo, ...(poster ?? photos[0] ? { poster: poster ?? photos[0] } : {}) };
}

export function facebookPostText(post: ApifyFacebookPost): string | undefined {
  for (const value of [post.text, post.message]) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function facebookAuthor(post: ApifyFacebookPost): string | undefined {
  return (post.user?.name ?? post.pageName)?.trim() || undefined;
}
