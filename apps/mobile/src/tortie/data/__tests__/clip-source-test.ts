import {
  clipSource,
  clipSourceKey,
  embedFor,
  embedHtml,
  parseEmbedEvent,
  tiktokId,
  youtubeId,
} from '@/tortie/data/clip-source';
import { platformOf } from '@/tortie/data/step-clips';

const FILE = 'http://localhost:3000/api/v1/recipes/r1/video';

function source(url: string, instagramFile = false) {
  return clipSource({
    platform: platformOf(url),
    url,
    file: FILE,
    instagramFile,
  });
}

describe('youtubeId', () => {
  test('reads every link shape', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(
      youtubeId('https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  test('rejects links without a video', () => {
    expect(youtubeId('https://www.youtube.com/@channel')).toBeNull();
    expect(youtubeId('https://youtu.be/short')).toBeNull();
  });
});

describe('tiktokId', () => {
  test('reads full links, not short ones', () => {
    expect(
      tiktokId(
        'https://www.tiktok.com/@chef/video/7301234567890123456?lang=en',
      ),
    ).toBe('7301234567890123456');
    expect(tiktokId('https://vm.tiktok.com/ZMabc123/')).toBeNull();
  });
});

describe('clipSource', () => {
  test('embeds YouTube, TikTok and Facebook, never their stored file', () => {
    expect(source('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      kind: 'embed',
      embed: { kind: 'youtube', id: 'dQw4w9WgXcQ' },
    });
    expect(source('https://www.tiktok.com/@a/video/1')).toEqual({
      kind: 'embed',
      embed: { kind: 'tiktok', id: '1' },
    });
    expect(source('https://www.facebook.com/watch/?v=42')).toEqual({
      kind: 'embed',
      embed: { kind: 'facebook', href: 'https://www.facebook.com/watch/?v=42' },
    });
  });

  test('plays Instagram from the stored file only behind the flag', () => {
    const reel = 'https://www.instagram.com/reel/abc/';
    expect(source(reel)).toBeNull();
    expect(source(reel, true)).toEqual({ kind: 'file', uri: FILE });
    expect(
      clipSource({
        platform: platformOf(reel),
        url: reel,
        file: null,
        instagramFile: true,
      }),
    ).toBeNull();
  });

  test('has no player for links it cannot embed', () => {
    expect(source('https://vm.tiktok.com/ZMabc123/')).toBeNull();
    expect(source('https://example.com/recipe')).toBeNull();
    expect(embedFor(null, 'https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  test('keys tell sources apart', () => {
    expect(clipSourceKey({ kind: 'file', uri: FILE })).toBe(`file:${FILE}`);
    expect(
      clipSourceKey({ kind: 'embed', embed: { kind: 'youtube', id: 'x' } }),
    ).toBe('youtube:x');
  });
});

describe('embedHtml', () => {
  test('loads each platform player and sends the app origin to YouTube', () => {
    const yt = embedHtml(
      { kind: 'youtube', id: 'dQw4w9WgXcQ' },
      'https://com.tortie.com',
    );
    expect(yt).toContain('https://www.youtube.com/iframe_api');
    expect(yt).toContain('"https://com.tortie.com"');
    expect(embedHtml({ kind: 'tiktok', id: '7' }, 'o')).toContain(
      'https://www.tiktok.com/player/v1/7?',
    );
    expect(
      embedHtml({ kind: 'facebook', href: 'https://fb.com/v' }, 'o'),
    ).toContain('connect.facebook.net');
  });

  test('cannot be broken out of by a link', () => {
    const html = embedHtml(
      { kind: 'facebook', href: 'https://x/</script><b>' },
      'o',
    );
    expect(html).not.toContain('</script><b>');
  });
});

describe('parseEmbedEvent', () => {
  test('reads bridge messages and ignores the rest', () => {
    expect(parseEmbedEvent('{"type":"time","t":12.5}')).toEqual({
      type: 'time',
      t: 12.5,
    });
    expect(parseEmbedEvent('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseEmbedEvent('{"type":"time"}')).toBeNull();
    expect(parseEmbedEvent('{"type":"other"}')).toBeNull();
    expect(parseEmbedEvent('not json')).toBeNull();
  });
});
