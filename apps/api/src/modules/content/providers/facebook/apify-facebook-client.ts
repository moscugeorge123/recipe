import {
  formatApifyError,
  isApifyErrorItem,
} from '../instagram/apify-client.js';

export interface ApifyFacebookMedia {
  /** `Photo`, `Video`, ... as reported by the actor. */
  __typename?: string;
  thumbnail?: string;
  /** Text recognised in the photo by Facebook, when present. */
  ocrText?: string;
  url?: string;
  photo_image?: { uri?: string };
  image?: { uri?: string };
  video_url?: string;
  videoUrl?: string;
  playable_url?: string;
  browser_native_hd_url?: string;
  browser_native_sd_url?: string;
}

/** One item from `apify~facebook-posts-scraper`. Only the fields the importer reads. */
export interface ApifyFacebookPost {
  postId?: string;
  url?: string;
  text?: string;
  message?: string;
  title?: string;
  pageName?: string;
  user?: { name?: string };
  media?: ApifyFacebookMedia[];
  error?: string | { message?: string };
  errorDescription?: string;
  '#error'?: boolean;
}

export interface ApifyFacebookInput {
  url: string;
  resultsLimit?: number;
}

export interface ApifyFacebookClient {
  runFacebookPostsScraper(input: ApifyFacebookInput): Promise<ApifyFacebookPost[]>;
}

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~facebook-posts-scraper';
const RUN_TIMEOUT_SECS = 120;

/** Validates the dataset and rejects error items so the pipeline never continues on them. */
export function parseFacebookDatasetItems(body: unknown): ApifyFacebookPost[] {
  if (!Array.isArray(body)) {
    throw new Error(formatApifyError(body).replace('Instagram post', 'Facebook post'));
  }
  if (body.length === 0) {
    throw new Error('No Facebook content returned for URL');
  }
  const posts = body.filter((item) => !isApifyErrorItem(item)) as ApifyFacebookPost[];
  if (posts.length === 0) {
    throw new Error(formatApifyError(body[0]).replace('Instagram post', 'Facebook post'));
  }
  return posts;
}

/** Reads public Facebook posts, photos and reels through the Apify Facebook Posts Scraper actor. */
export class HttpApifyFacebookClient implements ApifyFacebookClient {
  constructor(
    private readonly apiToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async runFacebookPostsScraper(input: ApifyFacebookInput): Promise<ApifyFacebookPost[]> {
    if (!this.apiToken) {
      throw new Error('Facebook import is not configured: APIFY_API_TOKEN is missing');
    }

    const response = await this.fetchImpl(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(this.apiToken)}&timeout=${String(RUN_TIMEOUT_SECS)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: input.url }],
          resultsLimit: input.resultsLimit ?? 1,
        }),
        signal: AbortSignal.timeout((RUN_TIMEOUT_SECS + 15) * 1000),
      },
    );

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Apify request failed: ${String(response.status)} ${response.statusText}`);
    }

    if (!response.ok) {
      throw new Error(`Apify request failed: ${formatApifyError(body)} (${String(response.status)})`);
    }

    return parseFacebookDatasetItems(body);
  }
}
