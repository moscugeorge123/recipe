import type { SourceType } from '@prisma/client';

import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';

/** Returns deterministic fixture content for pipeline integration tests (Phase 4). */
export class FakeContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'GENERIC_WEB';

  supports(url: string): boolean {
    return url.includes('fake-content') || url.includes('example.com/fake-recipe');
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    return {
      sourceType: 'GENERIC_WEB',
      originalUrl: url,
      normalizedUrl: url,
      title: 'Fake Pasta Recipe',
      caption: 'Mix 200g spaghetti with garlic and olive oil. Serves 2. Calories: 420 per serving.',
      description: 'A simple weeknight pasta from the fake provider fixture.',
      author: 'fixture-chef',
      language: 'en',
      thumbnailUrl: 'https://example.com/fake-thumb.jpg',
      images: [],
      metadata: {
        provider: 'fake',
        jobId: ctx.jobId,
      },
    };
  }
}
