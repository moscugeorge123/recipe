import { decodeHtmlEntities } from '../../preview/open-graph.js';

export const PAGE_TEXT_LIMIT = 12_000;

const DROP_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'canvas',
  'nav',
  'header',
  'footer',
  'aside',
  // not `form`: ASP.NET-style sites wrap the whole body in one.
  'button',
  'select',
];
const BLOCK_TAGS =
  /<\/?(?:p|div|section|article|main|h[1-6]|tr|table|ul|ol|dl|dt|dd|blockquote|figure|figcaption|pre)\b[^>]*>/gi;
const MIN_MAIN_TEXT = 200;

/**
 * Readable main text of a page: drops scripts, styles, navigation chrome and forms, prefers
 * `<article>` / `<main>` when they hold real content, and caps the result at a word boundary.
 */
export function extractPageText(html: string, limit = PAGE_TEXT_LIMIT): string {
  let cleaned = html.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of DROP_ELEMENTS) {
    cleaned = cleaned.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
    cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), ' ');
  }

  const candidates = [
    innerOf(cleaned, 'article'),
    innerOf(cleaned, 'main'),
    innerOf(cleaned, 'body'),
  ];
  let text = '';
  for (const candidate of candidates) {
    if (candidate === undefined) {
      continue;
    }
    const t = htmlToText(candidate);
    if (t.length >= MIN_MAIN_TEXT || !text) {
      text = t;
    }
    if (t.length >= MIN_MAIN_TEXT) {
      break;
    }
  }
  if (!text) {
    text = htmlToText(cleaned.replace(/<head\b[\s\S]*?<\/head\s*>/i, ' '));
  }

  return capAtWord(text, limit);
}

function innerOf(html: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}\\s*>`, 'i').exec(html);
  return match?.[1];
}

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withBreaks)
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .filter((line) => line && line !== '-')
    .join('\n')
    .trim();
}

function capAtWord(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > limit * 0.8 ? slice.slice(0, lastSpace) : slice).trim();
}
