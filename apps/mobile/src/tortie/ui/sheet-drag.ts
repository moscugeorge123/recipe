const PULL_DY = 8;
const OUTSIDE_DY = 16;
const HORIZONTAL_DX = 24;
const TOP_Y = 1;

export type SheetDragDecision = 'activate' | 'fail' | 'wait';

/**
 * Downward drags pull the sheet when its body can't scroll, or the scroll is
 * already at the top. While a scroller still has room, the drag waits so the
 * list can reach the top and then the sheet takes over. A downward drag that
 * never moves the scroller (header, footer) pulls the sheet too.
 */
export function sheetDragDecision(input: {
  dx: number;
  dy: number;
  contentH: number;
  viewH: number;
  scrollY: number;
  scrollActive: boolean;
}): SheetDragDecision {
  'worklet';
  const adx = Math.abs(input.dx);
  const ady = Math.abs(input.dy);
  if (adx > HORIZONTAL_DX && adx > ady) return 'fail';
  if (input.dy < -PULL_DY && ady > adx) return 'fail';
  if (input.dy <= PULL_DY || input.dy <= adx) return 'wait';
  if (input.contentH < 0 || input.viewH < 0) return 'wait';
  const scrollable = input.contentH > input.viewH + 1;
  if (!scrollable || input.scrollY <= TOP_Y) return 'activate';
  if (input.scrollActive) return 'wait';
  if (input.dy > OUTSIDE_DY) return 'activate';
  return 'wait';
}
