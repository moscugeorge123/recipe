/**
 * Recipe detail request budget (Agent 8).
 *
 * Immediate GETs: `/recipes/:id`, `/pantry` (one list), `/recipes/:id/nutrition`.
 * Deferred GETs: `/recipes/:id/notes` after first interactions;
 * `/categories` only when editing chips.
 * Never fan out per ingredient, note, or category on this screen.
 */
export const RECIPE_DETAIL_MAX_UNIQUE_GETS = 5;

export function detailResourcePath(url: string): string {
  const withoutHost = String(url).replace(/^https?:\/\/[^/]+/i, '');
  const path = withoutHost.replace(/^\/api\/v1/, '');
  return path.split('?')[0] ?? path;
}

export function isFanOutDetailRequest(url: string): boolean {
  const path = detailResourcePath(url);
  return (
    /\/ingredients\/[^/]+/.test(path) ||
    /\/notes\/[^/]+$/.test(path) ||
    /\/categories\/[^/]+/.test(path)
  );
}

export function uniqueRecipeDetailGets(urls: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const url of urls) {
    const path = detailResourcePath(url);
    if (
      /^\/recipes\/[^/]+$/.test(path) ||
      path === '/pantry' ||
      /^\/recipes\/[^/]+\/nutrition$/.test(path) ||
      /^\/recipes\/[^/]+\/notes$/.test(path) ||
      path === '/categories'
    ) {
      unique.add(path);
    }
  }
  return [...unique];
}
