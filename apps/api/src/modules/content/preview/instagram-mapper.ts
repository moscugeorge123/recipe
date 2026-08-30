import { decodeHtmlEntities } from './open-graph.js';

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

/** First caption line, before ingredient lists / bullet rows. */
export function instagramHeadlineFromCaption(remainder: string): string | null {
  const decoded = decodeHtmlEntities(remainder).replace(/\r\n/g, '\n').trim();
  const firstLine = (decoded.split('\n')[0] ?? '').trim();
  const beforeList = firstLine.split(/\u25aa\ufe0f?/)[0]?.trim() ?? '';
  return emptyToNull(beforeList);
}

export function titleIfDistinct(title: string | null, author: string | null): string | null {
  if (!title) {
    return null;
  }
  if (author && normalizeHandle(title) === normalizeHandle(author)) {
    return null;
  }
  return title;
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function mapInstagramOembed(input: {
  author_name?: string | null;
  title?: string | null;
  thumbnail_url?: string | null;
}): { author: string | null; title: string | null; thumbnailUrl: string | null } {
  const author = emptyToNull(input.author_name);
  const title = titleIfDistinct(
    instagramHeadlineFromCaption(input.title ?? ''),
    author,
  );
  return {
    author,
    title,
    thumbnailUrl: emptyToNull(input.thumbnail_url),
  };
}

/**
 * Typical Instagram `og:title` is `{user} on Instagram: "…"`.
 * Author comes from the `{user}` prefix; title from the quoted / after-colon remainder.
 */
export function parseInstagramOgTitle(ogTitle: string | null): {
  author: string | null;
  title: string | null;
} {
  const raw = emptyToNull(ogTitle ? decodeHtmlEntities(ogTitle) : null);
  if (!raw) {
    return { author: null, title: null };
  }

  if (/^instagram$/i.test(raw)) {
    return { author: null, title: null };
  }

  const match = raw.match(/^(.+?) on Instagram(?:\s*:\s*([\s\S]*))?$/i);
  if (!match) {
    return { author: null, title: instagramHeadlineFromCaption(raw) };
  }

  const author = emptyToNull(match[1]);
  let remainder = match[2]?.trim() ?? '';
  remainder = remainder.replace(/^[“"']+|[”"']+$/g, '').trim();
  const title = titleIfDistinct(instagramHeadlineFromCaption(remainder), author);

  return { author, title };
}
