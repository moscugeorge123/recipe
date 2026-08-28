import type { SourceType } from '@prisma/client';

import { UnsupportedSourceError } from '../../../../shared/errors/extraction-errors.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';

export class TikTokContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'TIKTOK';

  supports(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'tiktok.com' || host.endsWith('.tiktok.com');
    } catch {
      return false;
    }
  }

  acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    void url;
    void ctx;
    return Promise.reject(
      new UnsupportedSourceError({
        message: 'TikTok content extraction is not yet supported',
      }),
    );
  }
}
