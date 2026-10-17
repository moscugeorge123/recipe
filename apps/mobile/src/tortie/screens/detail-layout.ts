/** Labels of the recipe detail tabs, in order. */
export const DETAIL_TABS = ['Ingredients', 'Steps'] as const;

/**
 * Height the tab area should take: the measured height of the active panel, or
 * `undefined` until it has been measured (the caller keeps its natural layout).
 */
export function activePanelHeight(
  heights: readonly (number | undefined)[],
  seg: number,
): number | undefined {
  const h = heights[seg];
  return h != null && h > 0 ? h : undefined;
}

/** Lines of the description shown while it is collapsed. */
export const DESC_LINES = 3;

export type DescLayout = {
  /** More lines than fit: show the More / Less toggle. */
  truncated: boolean;
  /** Height of the whole text. */
  full: number;
  /** Height of the first `DESC_LINES` lines. */
  clamped: number;
};

/** Reads the line heights from `onTextLayout` of the unclamped description. */
export function descLayout(
  lines: readonly { height: number }[],
  max = DESC_LINES,
): DescLayout {
  const sum = (ls: readonly { height: number }[]) =>
    Math.ceil(ls.reduce((a, l) => a + l.height, 0));
  return {
    truncated: lines.length > max,
    full: sum(lines),
    clamped: sum(lines.slice(0, max)),
  };
}

/**
 * Scroll offset to jump to after switching to a shorter tab, or `null` to stay
 * put: only when the page is scrolled past where the segmented control sits and
 * the new panel is shorter than the old one.
 */
export function scrollAfterTabSwitch(
  scrollY: number,
  controlY: number,
  fromHeight: number | undefined,
  toHeight: number | undefined,
): number | null {
  if (fromHeight == null || toHeight == null || toHeight >= fromHeight)
    return null;
  return scrollY > controlY ? controlY : null;
}
