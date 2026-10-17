import { plz } from '@/tortie/lib/fmt';

/** "3 recipes · 2 favourites" / "1 recipe · 0 favourites". */
export function cookbookSubtitle(total: number, favourites: number): string {
  return `${plz(total, 'recipe')} · ${plz(favourites, 'favourite')}`;
}

/**
 * The "Showing 1 of 4" line under the chips. `null` when nothing is narrowed
 * or nothing is hidden.
 */
export function showingSummary(
  shown: number,
  total: number,
  narrowed: boolean,
): string | null {
  if (!narrowed || shown >= total) return null;
  return `Showing ${shown} of ${total}`;
}
