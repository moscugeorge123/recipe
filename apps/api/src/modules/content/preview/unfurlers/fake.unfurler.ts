import type { LinkPreview, LinkUnfurler } from '../types.js';

const FAKE_THUMBNAILS = [
  'https://example.com/fake-thumb.jpg',
  'https://example.com/fake-thumb-2.jpg',
  'https://example.com/fake-thumb-3.jpg',
];

export class FakeLinkUnfurler implements LinkUnfurler {
  supports(url: string): boolean {
    return url.includes('fake-content') || url.includes('example.com/fake-recipe');
  }

  unfurl(url: string): Promise<LinkPreview> {
    return Promise.resolve({
      url,
      sourceType: 'GENERIC_WEB',
      title: 'Fake Pasta Recipe',
      author: 'fixture-chef',
      description: 'A simple weeknight pasta from the fake provider fixture.',
      thumbnails: FAKE_THUMBNAILS.map((thumbUrl) => ({ url: thumbUrl })),
    });
  }
}
