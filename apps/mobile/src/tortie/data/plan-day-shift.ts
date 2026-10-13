export type PlanDayShift =
  | { kind: 'setDay'; day: number }
  | { kind: 'goDate'; wk: number; day: number }
  | { kind: 'noop' };

/**
 * Next plan day from a horizontal swipe.
 * `translationX < 0` (finger left) → next day; `> 0` → previous day; `0` → noop.
 * Day index is Monday=0 … Sunday=6.
 */
export function planDayShift(
  wk: number,
  day: number,
  translationX: number,
): PlanDayShift {
  if (translationX === 0 || !Number.isFinite(translationX)) {
    return { kind: 'noop' };
  }
  if (translationX < 0) {
    if (day >= 6) return { kind: 'goDate', wk: wk + 1, day: 0 };
    return { kind: 'setDay', day: day + 1 };
  }
  if (day <= 0) return { kind: 'goDate', wk: wk - 1, day: 6 };
  return { kind: 'setDay', day: day - 1 };
}

/** True when the pan should commit a day change. */
export function shouldCommitDaySwipe(
  translationX: number,
  velocityX: number,
  translationY = 0,
): boolean {
  const ax = Math.abs(translationX);
  const ay = Math.abs(translationY);
  if (ay >= ax) return false;
  return ax > 48 || (ax > 20 && Math.abs(velocityX) > 800);
}
