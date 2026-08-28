export interface ApifyInstagramInput {
  directUrls: string[];
  resultsLimit?: number;
}

export interface ApifyInstagramPost {
  caption?: string;
  text?: string;
  alt?: string;
  ownerUsername?: string;
  displayUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  error?: string | { message?: string; type?: string };
  errorDescription?: string;
  '#error'?: boolean;
}

export interface ApifyClient {
  runInstagramScraper(input: ApifyInstagramInput): Promise<ApifyInstagramPost[]>;
}

const APIFY_BASE = 'https://api.apify.com/v2';

export function isApifyErrorItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const record = item as Record<string, unknown>;
  if (record['#error'] === true) {
    return true;
  }
  if (typeof record.errorDescription === 'string' && record.errorDescription.trim().length > 0) {
    return true;
  }
  if (typeof record.error === 'string' && record.error.trim().length > 0) {
    return true;
  }
  if (record.error && typeof record.error === 'object') {
    return true;
  }
  return false;
}

export function formatApifyError(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return 'Apify could not extract this Instagram post';
  }

  const record = value as Record<string, unknown>;
  if (typeof record.errorDescription === 'string' && record.errorDescription.trim()) {
    return record.errorDescription.trim();
  }
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim();
  }
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim();
    }
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }

  return 'Apify could not extract this Instagram post';
}

/** Validates Apify dataset JSON and rejects error items so the pipeline does not continue. */
export function parseApifyDatasetItems(body: unknown): ApifyInstagramPost[] {
  if (!Array.isArray(body)) {
    throw new Error(formatApifyError(body));
  }

  if (body.length === 0) {
    throw new Error('No Instagram content returned for URL');
  }

  const posts = body.filter((item) => !isApifyErrorItem(item)) as ApifyInstagramPost[];
  if (posts.length === 0) {
    throw new Error(formatApifyError(body[0]));
  }

  return posts;
}

/** Fetches Instagram reel/post metadata via the Apify Instagram scraper actor. */
export class HttpApifyClient implements ApifyClient {
  constructor(private readonly apiToken: string) {}

  async runInstagramScraper(input: ApifyInstagramInput): Promise<ApifyInstagramPost[]> {
    const actorId = 'apify~instagram-scraper';
    const runResponse = await fetch(
      `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(this.apiToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: input.directUrls,
          resultsLimit: input.resultsLimit ?? 1,
        }),
      },
    );

    let body: unknown;
    try {
      body = await runResponse.json();
    } catch {
      throw new Error(
        `Apify request failed: ${String(runResponse.status)} ${runResponse.statusText}`,
      );
    }

    if (!runResponse.ok) {
      throw new Error(
        `Apify request failed: ${formatApifyError(body)} (${String(runResponse.status)})`,
      );
    }

    return parseApifyDatasetItems(body);
  }
}
