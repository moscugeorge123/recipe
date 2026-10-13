/** The five stage captions of the import card, switched by progress. */
export const IMPORT_STAGES: readonly { at: number; label: string }[] = [
  { at: 0, label: 'Reading the page' },
  { at: 18, label: 'Grabbing the photo' },
  { at: 34, label: 'Picking out ingredients' },
  { at: 66, label: 'Writing the steps' },
  { at: 94, label: 'Plating it up' },
];

/** Index (0–4) of the stage that `pct` falls in. */
export function importStageIndex(pct: number): number {
  let i = 0;
  for (let k = 0; k < IMPORT_STAGES.length; k++) {
    if (pct >= IMPORT_STAGES[k]!.at) i = k;
  }
  return i;
}

export function importStageLabel(pct: number): string {
  return IMPORT_STAGES[importStageIndex(pct)]!.label;
}

/** The scan beam only runs while the page is still being read. */
export const SCAN_BEAM_UNTIL = 22;
