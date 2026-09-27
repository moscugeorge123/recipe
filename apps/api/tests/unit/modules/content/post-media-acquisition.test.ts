import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApifyInstagramPost } from '../../../../src/modules/content/providers/instagram/apify-client.js';
import { InstagramContentProvider } from '../../../../src/modules/content/providers/instagram/instagram-content-provider.js';
import { extractInstagramSlides } from '../../../../src/modules/content/providers/instagram/instagram-slides.js';
import {
  buildCaptionTrack,
  collapseRollingSegments,
  parseVttCaptions,
  selectCaptionTrack,
} from '../../../../src/modules/content/providers/youtube/youtube-captions.js';
import type { VideoDownloadClient, YtDlpMetadata } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';
import { YouTubeContentProvider } from '../../../../src/modules/content/providers/youtube/youtube-content-provider.js';

let tempDir: string;
const ctxFor = () => ({ jobId: 'job-1', outputLanguage: 'en', tempDir });

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'post-media-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function videoFetch() {
  return vi.fn(async (url: string) =>
    new Response(Buffer.from(`video-bytes:${url}`), {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    }),
  );
}

describe('extractInstagramSlides', () => {
  it('uses childPosts for a Sidecar and keeps slide order', () => {
    const slides = extractInstagramSlides({
      type: 'Sidecar',
      displayUrl: 'https://cdn/1.jpg',
      images: ['https://cdn/1.jpg'],
      childPosts: [1, 2, 3, 4, 5].map((n) => ({ type: 'Image', displayUrl: `https://cdn/${String(n)}.jpg` })),
    });
    expect(slides.map((s) => [s.slideIndex, s.kind, s.imageUrl])).toEqual([
      [1, 'image', 'https://cdn/1.jpg'],
      [2, 'image', 'https://cdn/2.jpg'],
      [3, 'image', 'https://cdn/3.jpg'],
      [4, 'image', 'https://cdn/4.jpg'],
      [5, 'image', 'https://cdn/5.jpg'],
    ]);
  });

  it('falls back to carouselImages / images when childPosts is missing', () => {
    expect(
      extractInstagramSlides({ type: 'Sidecar', carouselImages: ['a', 'b', 'c'], images: ['x'] }).map(
        (s) => s.imageUrl,
      ),
    ).toEqual(['a', 'b', 'c']);
    expect(extractInstagramSlides({ type: 'Sidecar', images: ['a', 'b', 'a'] }).map((s) => s.imageUrl)).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats a reel as one video slide and a photo as one image slide', () => {
    expect(
      extractInstagramSlides({ type: 'Video', videoUrl: 'v.mp4', displayUrl: 'cover.jpg', images: ['cover.jpg'] }),
    ).toEqual([{ slideIndex: 1, kind: 'video', videoUrl: 'v.mp4', imageUrl: 'cover.jpg' }]);
    expect(extractInstagramSlides({ type: 'Image', displayUrl: 'p.jpg', images: [] })).toEqual([
      { slideIndex: 1, kind: 'image', imageUrl: 'p.jpg' },
    ]);
  });
});

describe('InstagramContentProvider media acquisition', () => {
  it('returns all 5 carousel slides as ordered OCR-able images, even without a caption', async () => {
    const post: ApifyInstagramPost = {
      type: 'Sidecar',
      ownerUsername: 'chef',
      displayUrl: 'https://cdn/1.jpg',
      childPosts: [1, 2, 3, 4, 5].map((n) => ({ type: 'Image', displayUrl: `https://cdn/${String(n)}.jpg` })),
    };
    const provider = new InstagramContentProvider({ runInstagramScraper: async () => [post] });

    const content = await provider.acquire('https://www.instagram.com/p/carousel/', ctxFor());

    expect(content.caption).toBeUndefined();
    expect(content.images.map((i) => [i.slideIndex, i.url])).toEqual(
      [1, 2, 3, 4, 5].map((n) => [n, `https://cdn/${String(n)}.jpg`]),
    );
    expect(content.videoLocalPath).toBeUndefined();
    expect(content.metadata).toMatchObject({ postType: 'Sidecar', slideCount: 5 });
  });

  it('downloads carousel videos and keeps image slides for a mixed carousel', async () => {
    const fetchImpl = videoFetch();
    const post: ApifyInstagramPost = {
      type: 'Sidecar',
      caption: 'Tacos 3 ways',
      childPosts: [
        { type: 'Image', displayUrl: 'https://cdn/1.jpg' },
        { type: 'Video', displayUrl: 'https://cdn/2-cover.jpg', videoUrl: 'https://cdn/2.mp4' },
        { type: 'Image', displayUrl: 'https://cdn/3.jpg' },
        { type: 'Video', displayUrl: 'https://cdn/4-cover.jpg', videoUrl: 'https://cdn/4.mp4' },
      ],
    };
    const provider = new InstagramContentProvider({ runInstagramScraper: async () => [post] }, { fetchImpl });

    const content = await provider.acquire('https://www.instagram.com/p/mixed/', ctxFor());

    expect(content.images.map((i) => i.slideIndex)).toEqual([1, 3]);
    expect(content.videos?.map((v) => v.slideIndex)).toEqual([2, 4]);
    expect(content.videoLocalPath).toBe(content.videos?.[0]?.localPath);
    expect(await readFile(content.videos?.[1]?.localPath ?? '', 'utf8')).toBe('video-bytes:https://cdn/4.mp4');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('respects the carousel video cap', async () => {
    const fetchImpl = videoFetch();
    const post: ApifyInstagramPost = {
      type: 'Sidecar',
      caption: 'x',
      childPosts: [1, 2, 3].map((n) => ({ type: 'Video', videoUrl: `https://cdn/${String(n)}.mp4` })),
    };
    const provider = new InstagramContentProvider(
      { runInstagramScraper: async () => [post] },
      { fetchImpl, maxVideos: 1 },
    );
    const content = await provider.acquire('https://www.instagram.com/p/videos/', ctxFor());
    expect(content.videos).toHaveLength(1);
  });

  it('downloads a reel video so frames and audio can be processed', async () => {
    const provider = new InstagramContentProvider(
      {
        runInstagramScraper: async () => [
          { type: 'Video', caption: 'Recipe in video', videoUrl: 'https://cdn/reel.mp4', displayUrl: 'https://cdn/cover.jpg' },
        ],
      },
      { fetchImpl: videoFetch() },
    );
    const content = await provider.acquire('https://www.instagram.com/reel/x/', ctxFor());

    expect(content.videoLocalPath).toBe(path.join(tempDir, 'video.mp4'));
    expect(content.videos).toEqual([{ localPath: path.join(tempDir, 'video.mp4') }]);
    // The reel cover is kept for previews but is not an OCR slide.
    expect(content.images).toEqual([{ url: 'https://cdn/cover.jpg', mimeType: 'image/jpeg' }]);
  });

  it('still rejects posts with neither text nor media', async () => {
    const provider = new InstagramContentProvider({ runInstagramScraper: async () => [{ ownerUsername: 'x' }] });
    await expect(provider.acquire('https://www.instagram.com/p/empty/', ctxFor())).rejects.toThrow(
      /without a caption, text, image or video/,
    );
  });
});

describe('YouTube captions', () => {
  const vtt = [
    'WEBVTT',
    'Kind: captions',
    '',
    '00:00:00.000 --> 00:00:02.000',
    'add the',
    '',
    '00:00:01.500 --> 00:00:03.000',
    'add the <c>flour</c>',
    '',
    '00:00:03.000 --> 00:00:05.000',
    'then two eggs',
    '',
  ].join('\n');

  it('parses VTT and collapses rolling auto-caption lines', () => {
    const segments = collapseRollingSegments(parseVttCaptions(vtt));
    expect(segments.map((s) => s.text)).toEqual(['add the flour', 'then two eggs']);
    expect(segments[0]?.startSeconds).toBe(0);
  });

  it('prefers manual subtitles in the video language, else the original-language ASR track', () => {
    const base: YtDlpMetadata = {
      language: 'en',
      subtitles: { live_chat: [{ ext: 'json', url: 'chat' }], en: [{ ext: 'vtt', url: 'manual-en.vtt' }] },
      automatic_captions: { 'en-orig': [{ ext: 'json3', url: 'auto.json3' }], fr: [{ ext: 'json3', url: 'fr' }] },
    };
    expect(selectCaptionTrack(base)).toMatchObject({ kind: 'manual', language: 'en', url: 'manual-en.vtt' });
    expect(selectCaptionTrack({ ...base, subtitles: {} })).toMatchObject({
      kind: 'auto',
      language: 'en',
      format: 'json3',
      url: 'auto.json3',
    });
    expect(selectCaptionTrack({ language: 'en', automatic_captions: { fr: [{ ext: 'vtt', url: 'fr' }] } })).toBeUndefined();
  });

  it('builds a caption track from json3', () => {
    const body = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Whisk ' }, { utf8: 'eggs' }] },
        { tStartMs: 2000, segs: [{ utf8: '\n' }] },
        { tStartMs: 2500, dDurationMs: 1000, segs: [{ utf8: 'Add cheese' }] },
      ],
    });
    const track = buildCaptionTrack({ kind: 'auto', language: 'en', format: 'json3', url: 'x' }, body);
    expect(track?.text).toBe('Whisk eggs Add cheese');
    expect(track?.segments).toHaveLength(2);
  });

  it('attaches subtitles and chapters to acquired YouTube content (Shorts URL)', async () => {
    const ytdlp: VideoDownloadClient = {
      fetchMetadata: async () => ({
        title: 'Carbonara',
        description: 'Classic Roman pasta',
        language: 'en',
        chapters: [
          { start_time: 0, title: 'Ingredients' },
          { start_time: 75, title: 'Sauce' },
        ],
        subtitles: { en: [{ ext: 'vtt', url: 'https://yt/subs.vtt' }] },
      }),
      download: async () => ({ filePath: '/tmp/short.mp4', metadata: {} }),
    };
    const fetchImpl = vi.fn(async () => new Response(vtt, { status: 200, headers: { 'content-type': 'text/vtt' } }));
    const provider = new YouTubeContentProvider(ytdlp, { fetchImpl });
    const url = 'https://www.youtube.com/shorts/abc123';

    expect(provider.supports(url)).toBe(true);
    const content = await provider.acquire(url, ctxFor());

    expect(fetchImpl).toHaveBeenCalledWith('https://yt/subs.vtt', expect.anything());
    expect(content.captions).toMatchObject({ kind: 'manual', language: 'en', text: 'add the flour then two eggs' });
    expect(content.metadata.chapters).toEqual(['0:00 Ingredients', '1:15 Sauce']);
    expect(content.videos).toEqual([{ localPath: '/tmp/short.mp4' }]);
  });

  it('ignores caption download failures (Whisper remains the fallback)', async () => {
    const ytdlp: VideoDownloadClient = {
      fetchMetadata: async () => ({
        title: 'Cake',
        automatic_captions: { 'en-orig': [{ ext: 'vtt', url: 'https://yt/auto.vtt' }] },
      }),
      download: async () => ({ filePath: '/tmp/v.mp4', metadata: {} }),
    };
    const provider = new YouTubeContentProvider(ytdlp, {
      fetchImpl: async () => new Response('', { status: 429 }),
    });
    const content = await provider.acquire('https://youtu.be/abc', ctxFor());
    expect(content.captions).toBeUndefined();
    expect(content.videoLocalPath).toBe('/tmp/v.mp4');
  });
});
