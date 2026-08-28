import type { SourceType } from '@prisma/client';

import { UnsupportedSourceError } from '../../../../shared/errors/extraction-errors.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';

export class FacebookContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'FACEBOOK';

  supports(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'facebook.com' || host === 'www.facebook.com' || host.endsWith('.facebook.com');
    } catch {
      return false;
    }
  }

  acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    void url;
    void ctx;
    return Promise.reject(
      new UnsupportedSourceError({
        message: 'Facebook content extraction is not yet supported',
      }),
    );
  }
}
