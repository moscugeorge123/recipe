/** How long a snap-back drag keeps blocking a press, so the lift doesn't also hit Add. */
export const SHEET_PRESS_SETTLE_MS = 400;

export type SheetPressBlock = 'clear' | 'dragging' | 'settling' | 'dismissed';

export function blockOnDragStart(): SheetPressBlock {
  return 'dragging';
}

export function blockOnDragEnd(dismissed: boolean): SheetPressBlock {
  return dismissed ? 'dismissed' : 'settling';
}

export function blockAfterSettle(block: SheetPressBlock): SheetPressBlock {
  return block === 'settling' ? 'clear' : block;
}

/** A press commits only when no sheet drag is in progress or settling. */
export function sheetPressCommits(block: SheetPressBlock): boolean {
  return block === 'clear';
}
