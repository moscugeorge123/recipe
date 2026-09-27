import { describe, expect, it, vi } from 'vitest';

import { downloadMedia, type FetchLike } from '../../../src/shared/utils/download-media.js';

function ok(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'video/mp4' } });
}

describe('downloadMedia', () => {
  it('retries a connection failure and then succeeds', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok('video-bytes'));

    const result = await downloadMedia('https://cdn.example/video.mp4', { maxBytes: 1_000, fetchImpl });

    expect(result.data.toString()).toBe('video-bytes');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retries are exhausted', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      downloadMedia('https://cdn.example/video.mp4', { maxBytes: 1_000, fetchImpl }),
    ).rejects.toThrow('fetch failed');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry HTTP errors', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(new Response('', { status: 403 }));

    await expect(
      downloadMedia('https://cdn.example/video.mp4', { maxBytes: 1_000, fetchImpl }),
    ).rejects.toThrow('HTTP 403');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
