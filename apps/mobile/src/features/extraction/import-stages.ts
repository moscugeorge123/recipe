/** The four stage captions of the import card, switched by progress. */
export const IMPORT_STAGES: readonly { at: number; label: string }[] = [
  { at: 0, label: 'Reading the page' },
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

/** The bar's range while the server job is in a given stage. */
export type StageBounds = { floor: number; cap: number };

const READING: StageBounds = { floor: 0, cap: 17 };
const INGREDIENTS: StageBounds = { floor: 34, cap: 65 };
const STEPS: StageBounds = { floor: 66, cap: 93 };
const PLATING: StageBounds = { floor: 94, cap: 100 };

/**
 * Where the progress bar may be for a server job status, so the caption is never ahead of
 * the job. The floor pulls the bar up to the stage the server reports; the cap stops the
 * creep at the next stage's boundary. No status yet (the job is still being created) counts
 * as reading the page, and so does a status this app does not know.
 */
export function stageBoundsFor(status: string | null | undefined): StageBounds {
  switch (status) {
    case 'PROCESSING_MEDIA':
    case 'TRANSCRIBING':
    case 'ANALYZING_FRAMES':
    case 'RUNNING_OCR':
      return INGREDIENTS;
    case 'EXTRACTING_RECIPE':
    case 'NORMALIZING_RECIPE':
    case 'VALIDATING_RECIPE':
      return STEPS;
    case 'COMPLETED':
      return PLATING;
    default:
      return READING;
  }
}

/** The progress the bar should head for: time-based creep, held inside the stage's range. */
export function targetProgress(
  status: string | null | undefined,
  serverProgress: number,
  creep: number,
): number {
  const { floor, cap } = stageBoundsFor(status);
  return Math.min(cap, Math.max(floor, serverProgress, creep));
}
