/** Shared Open Graph / Twitter card HTML parser used by preview and GenericWeb acquire. */

export interface OpenGraphMetadata {
  title: string | null;
  description: string | null;
  images: string[];
}

function codePointToChar(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
    return '';
  }
  return String.fromCodePoint(value);
}

/** Decodes named entities and numeric `&#123;` / `&#x1f95a;` so preview titles show real emoji. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      codePointToChar(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => codePointToChar(Number.parseInt(dec, 10)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');
}

function extractMeta(html: string, property: string): string | null {
  const values = extractAllMeta(html, property);
  return values[0] ?? null;
}

export function extractAllMeta(html: string, property: string): string[] {
  const escaped = property.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'gi',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'gi',
    ),
  ];

  const values: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1]?.trim();
      if (!raw) {
        continue;
      }
      const decoded = decodeHtmlEntities(raw);
      if (!decoded || seen.has(decoded)) {
        continue;
      }
      seen.add(decoded);
      values.push(decoded);
    }
  }

  return values;
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

export function parseOpenGraph(html: string): OpenGraphMetadata {
  const title = extractMeta(html, 'og:title') ?? extractTag(html, 'title');
  const description =
    extractMeta(html, 'og:description') ?? extractMeta(html, 'description') ?? extractTag(html, 'description');

  const images = [
    ...extractAllMeta(html, 'og:image'),
    ...extractAllMeta(html, 'og:image:url'),
    ...extractAllMeta(html, 'twitter:image'),
    ...extractAllMeta(html, 'twitter:image:src'),
  ];

  const uniqueImages: string[] = [];
  const seen = new Set<string>();
  for (const url of images) {
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    uniqueImages.push(url);
  }

  return {
    title: title && title.length > 0 ? title : null,
    description: description && description.length > 0 ? description : null,
    images: uniqueImages,
  };
}
