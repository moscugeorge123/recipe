import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface DownloadOptions {
  maxBytes: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  /** Reject responses whose content-type does not start with one of these prefixes. */
  acceptContentTypes?: string[];
}

export interface DownloadedMedia {
  data: Buffer;
  contentType: string;
}

/** Media CDNs (Instagram, YouTube) sometimes reject requests without a browser-like UA. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Backoff before each retry of a connection-level failure (CDN connect timeouts are often transient). */
const CONNECT_RETRY_DELAYS_MS = [500, 1_500];

function isConnectionFailure(error: unknown): boolean {
  // undici reports DNS / connect / reset problems as `TypeError: fetch failed`; our own
  // AbortSignal timeout surfaces as a TimeoutError and must not be retried.
  return error instanceof TypeError && error.message === 'fetch failed';
}

async function fetchWithConnectRetry(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchImpl(url, init);
    } catch (error: unknown) {
      const delay = CONNECT_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isConnectionFailure(error) || init.signal?.aborted) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Downloads a remote image/video into memory, enforcing a byte cap while streaming. */
export async function downloadMedia(url: string, opts: DownloadOptions): Promise<DownloadedMedia> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchWithConnectRetry(fetchImpl, url, {
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });

  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${String(response.status)}`);
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (
    opts.acceptContentTypes &&
    contentType &&
    !opts.acceptContentTypes.some((prefix) => contentType.startsWith(prefix))
  ) {
    throw new Error(`Unexpected content-type ${contentType}`);
  }

  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > opts.maxBytes) {
    throw new Error(`Download exceeds ${String(opts.maxBytes)} bytes`);
  }

  if (!response.body) {
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > opts.maxBytes) {
      throw new Error(`Download exceeds ${String(opts.maxBytes)} bytes`);
    }
    return { data, contentType };
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > opts.maxBytes) {
      throw new Error(`Download exceeds ${String(opts.maxBytes)} bytes`);
    }
    chunks.push(Buffer.from(chunk));
  }

  return { data: Buffer.concat(chunks), contentType };
}

export async function downloadMediaToFile(
  url: string,
  destPath: string,
  opts: DownloadOptions,
): Promise<DownloadedMedia & { filePath: string }> {
  const downloaded = await downloadMedia(url, opts);
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, downloaded.data);
  return { ...downloaded, filePath: destPath };
}

export function imageExtension(contentType: string | undefined): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/heic':
      return 'heic';
    default:
      return 'jpg';
  }
}
