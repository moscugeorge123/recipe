import { isFacebookHost } from '../../providers/facebook/facebook-media.js';
import type { LinkPreview, LinkUnfurler } from '../types.js';

/**
 * Facebook serves a login wall to anything that is not signed in, so its Open Graph tags carry
 * no recipe information (the title is just "Facebook"). The preview names the source and leaves
 * the real reading to the importer.
 */
export class FacebookLinkUnfurler implements LinkUnfurler {
  supports(url: string): boolean {
    try {
      return isFacebookHost(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  unfurl(url: string): Promise<LinkPreview> {
    return Promise.resolve({
      url,
      sourceType: 'FACEBOOK',
      title: null,
      author: null,
      description: null,
      thumbnails: [],
    });
  }
}
