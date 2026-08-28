import { describe, expect, it } from 'vitest';

import { FakeContentProvider } from '../../../../src/modules/content/providers/fake/fake-content-provider.js';
import { InstagramContentProvider } from '../../../../src/modules/content/providers/instagram/instagram-content-provider.js';
import { YouTubeContentProvider } from '../../../../src/modules/content/providers/youtube/youtube-content-provider.js';
import { DefaultContentProviderRegistry } from '../../../../src/modules/content/registry/content-provider-registry.js';
import { UnsupportedSourceError } from '../../../../src/shared/errors/extraction-errors.js';

describe('ContentProviderRegistry', () => {
  it('selects the correct provider by URL', () => {
    const registry = new DefaultContentProviderRegistry();
    registry.register(
      new InstagramContentProvider({
        runInstagramScraper: async () => [],
      }),
    );
    registry.register(
      new YouTubeContentProvider({
        fetchMetadata: async () => ({}),
        download: async () => ({ filePath: '/tmp/v.mp4', metadata: {} }),
      }),
    );
    registry.register(new FakeContentProvider());

    expect(registry.detectSourceType('https://www.instagram.com/reel/abc/')).toBe('INSTAGRAM');
    expect(registry.detectSourceType('https://www.youtube.com/watch?v=abc')).toBe('YOUTUBE');
    expect(registry.detectSourceType('https://example.com/fake-recipe')).toBe('GENERIC_WEB');
  });

  it('throws for unsupported URLs', () => {
    const registry = new DefaultContentProviderRegistry();
    registry.register(new FakeContentProvider());

    expect(() => registry.getProvider('https://unsupported.example.net/video')).toThrow(
      UnsupportedSourceError,
    );
  });
});
