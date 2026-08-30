import { describe, expect, it } from 'vitest';

import { collapseYouTubeThumbnails } from '../../../../src/modules/content/preview/thumbnails.js';

const videoId = 'abc123';

function yt(name: string, width: number, height: number): { url: string; width: number; height: number } {
  return {
    url: `https://i.ytimg.com/vi/${videoId}/${name}.jpg`,
    width,
    height,
  };
}

describe('collapseYouTubeThumbnails', () => {
  it('collapses same-frame sizes to the highest resolution poster', () => {
    const result = collapseYouTubeThumbnails([
      yt('mqdefault', 320, 180),
      yt('hqdefault', 480, 360),
      yt('maxresdefault', 1280, 720),
    ]);

    expect(result).toEqual([{ url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` }]);
  });

  it('keeps numbered stills as distinct frames', () => {
    const result = collapseYouTubeThumbnails([
      yt('hqdefault', 480, 360),
      yt('maxresdefault', 1280, 720),
      yt('1', 120, 90),
      yt('2', 120, 90),
      yt('3', 120, 90),
    ]);

    expect(result.map((entry) => entry.url)).toEqual([
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/1.jpg`,
      `https://i.ytimg.com/vi/${videoId}/2.jpg`,
      `https://i.ytimg.com/vi/${videoId}/3.jpg`,
    ]);
  });

  it('uses the fallback thumbnail when the array is empty', () => {
    expect(collapseYouTubeThumbnails([], 'https://i.ytimg.com/vi/xyz/hqdefault.jpg')).toEqual([
      { url: 'https://i.ytimg.com/vi/xyz/hqdefault.jpg' },
    ]);
  });
});
