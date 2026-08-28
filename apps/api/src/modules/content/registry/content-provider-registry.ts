import type { SourceType } from '@prisma/client';

import { UnsupportedSourceError } from '../../../shared/errors/extraction-errors.js';
import type { ContentProvider, ContentProviderRegistry } from '../domain/types.js';

export class DefaultContentProviderRegistry implements ContentProviderRegistry {
  private readonly providers: ContentProvider[] = [];

  register(provider: ContentProvider): void {
    this.providers.push(provider);
  }

  getProvider(url: string): ContentProvider {
    const provider = this.providers.find((entry) => entry.supports(url));
    if (!provider) {
      throw new UnsupportedSourceError({
        message: 'The provided URL is not currently supported',
      });
    }
    return provider;
  }

  detectSourceType(url: string): SourceType {
    return this.getProvider(url).sourceType;
  }
}
