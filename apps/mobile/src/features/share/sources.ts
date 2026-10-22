import { SUPPORTED_PLATFORMS } from '@/features/capture/sources';
import type { Brand } from '@/tortie/ui/brand';
import { tNow } from '@/i18n/format';

/**
 * What the app promises for each place a link can come from. The Add sheet's logo strip, the
 * welcome copy and the share preview all read this, so nothing advertises a source the
 * backend turns away.
 *
 * - `supported`: imports work and are advertised.
 * - `partial`: the link is read as an ordinary web page; it may work, so it is not advertised.
 * - `unsupported`: the importer rejects it (`UNSUPPORTED_SOURCE`).
 */
export type SourceSupport = 'supported' | 'partial' | 'unsupported';

type SourceKind = Brand | 'web';

const NAME_OF: Record<SourceKind, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  web: 'Website',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  google: 'Google',
};

const PARTIAL: readonly SourceKind[] = ['pinterest'];

export function supportOf(kind: SourceKind): SourceSupport {
  if ((SUPPORTED_PLATFORMS as readonly string[]).includes(NAME_OF[kind])) {
    return 'supported';
  }
  return PARTIAL.includes(kind) ? 'partial' : 'unsupported';
}

/** Brand logos the Add sheet strip may show. */
export const ADVERTISED_BRANDS: readonly Brand[] = (
  ['instagram', 'tiktok', 'youtube', 'pinterest', 'facebook'] as const
).filter((kind) => supportOf(kind) === 'supported');

/** "Instagram, YouTube or any recipe website", for copy. */
export function advertisedSourcesText(): string {
  const names = ADVERTISED_BRANDS.map((kind) => NAME_OF[kind]);
  return tNow('share.sourcesText', { names: names.join(', ') });
}

/** Shown in place of an import button for a source the importer rejects. */
export function unsupportedSourceNote(name: string): string {
  return tNow('share.unsupportedNote', { name });
}
