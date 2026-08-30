import {
  captureGridMetrics,
  chunkIntoRows,
  inspectClipboard,
} from '@/features/capture/sources';

describe('inspectClipboard', () => {
  test('hides empty and short clipboard values', () => {
    expect(inspectClipboard('')).toEqual({ kind: 'hidden' });
    expect(inspectClipboard('   ')).toEqual({ kind: 'hidden' });
    expect(inspectClipboard('ok')).toEqual({ kind: 'hidden' });
    expect(inspectClipboard('pistachio pasta')).toEqual({ kind: 'hidden' });
    expect(inspectClipboard('user@example.com')).toEqual({ kind: 'hidden' });
  });

  test('offers Instagram and YouTube links, with or without a scheme', () => {
    expect(
      inspectClipboard('https://www.instagram.com/reel/C8xk2Rp9Lm/'),
    ).toMatchObject({
      kind: 'url',
      source: 'Instagram',
    });
    expect(inspectClipboard('instagram.com/p/abc123')).toMatchObject({
      kind: 'url',
      source: 'Instagram',
    });
    expect(inspectClipboard('https://youtu.be/dQw4w9wgGcQ')).toMatchObject({
      kind: 'url',
      source: 'YouTube',
    });
    expect(
      inspectClipboard('https://m.youtube.com/watch?v=abc123'),
    ).toMatchObject({
      kind: 'url',
      source: 'YouTube',
    });
  });

  test('offers other websites and hides unsupported social platforms', () => {
    expect(
      inspectClipboard('https://www.seriouseats.com/pistachio-pasta'),
    ).toMatchObject({
      kind: 'url',
      source: 'Website',
    });
    expect(inspectClipboard('bonappetit.com/recipe/soup')).toMatchObject({
      kind: 'url',
      source: 'Website',
    });
    expect(inspectClipboard('https://www.tiktok.com/@cook/video/1')).toEqual({
      kind: 'hidden',
    });
    expect(inspectClipboard('https://facebook.com/reel/123')).toEqual({
      kind: 'hidden',
    });
  });

  test('offers long pasted text and multiline recipes', () => {
    const paragraph =
      'Toast the pistachios, blend with lemon, garlic and pasta water, then toss through rigatoni until glossy.';
    expect(inspectClipboard(paragraph)).toMatchObject({
      kind: 'text',
      source: 'Text',
    });

    const list = [
      '200g pasta',
      '1 lemon',
      'handful of pistachios',
      'olive oil',
    ].join('\n');
    expect(inspectClipboard(list)).toMatchObject({
      kind: 'text',
      source: 'Text',
    });
  });
});

describe('captureGridMetrics', () => {
  test('sizes a single tile as a centered card, not a full-width bar', () => {
    expect(captureGridMetrics(1)).toEqual({
      columns: 1,
      tileColumns: 2,
    });
  });

  test('uses two columns for two or four sources', () => {
    expect(captureGridMetrics(2)).toEqual({ columns: 2, tileColumns: 2 });
    expect(captureGridMetrics(4)).toEqual({ columns: 2, tileColumns: 2 });
  });

  test('uses three columns for any other count', () => {
    expect(captureGridMetrics(3)).toEqual({ columns: 3, tileColumns: 3 });
    expect(captureGridMetrics(5).columns).toBe(3);
    expect(captureGridMetrics(6).columns).toBe(3);
    expect(captureGridMetrics(7)).toEqual({ columns: 3, tileColumns: 3 });
  });
});

describe('chunkIntoRows', () => {
  test('keeps leftover tiles on their own last row', () => {
    expect(chunkIntoRows(['a', 'b', 'c', 'd', 'e'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });
});
