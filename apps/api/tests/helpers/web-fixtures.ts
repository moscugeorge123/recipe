import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function webFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/web/${name}`, import.meta.url)), 'utf8');
}

/** `fetch` stand-in serving one HTML body, for GenericWebContentProvider tests. */
export function htmlFetch(
  html: string,
  init: { status?: number; contentType?: string } = {},
): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(html, {
        status: init.status ?? 200,
        headers: { 'content-type': init.contentType ?? 'text/html; charset=utf-8' },
      }),
    );
}
