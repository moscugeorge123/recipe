import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';
import { PHOTO_URL_SCHEME, parsePhotoSourceUrl } from './photo-source.js';

/**
 * Photos of cookbook pages, recipe cards and handwritten notes, uploaded through
 * `POST /recipes/extract/photos`. The pages are already in storage, so acquisition only lists
 * them; the media stages OCR and read them like carousel slides.
 */
export class PhotoContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'PHOTO';

  supports(url: string): boolean {
    return url.toLowerCase().startsWith(`${PHOTO_URL_SCHEME}//`);
  }

  acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    void ctx;
    const source = parsePhotoSourceUrl(url);
    if (!source) {
      return Promise.reject(
        new ContentAcquisitionFailedError({ message: 'The uploaded photos could not be found' }),
      );
    }

    return Promise.resolve({
      sourceType: 'PHOTO',
      originalUrl: url,
      normalizedUrl: url,
      images: source.pages.map((page) => ({
        url,
        mimeType: page.mimeType,
        slideIndex: page.index,
        storageKey: page.storageKey,
      })),
      metadata: {
        provider: 'upload',
        pageCount: source.pages.length,
      },
    });
  }
}
