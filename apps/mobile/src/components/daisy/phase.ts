export const DAISY_PHASES = [
  'idle',
  'importing',
  'analyzing',
  'processing',
  'success',
  'error',
] as const;

export type DaisyPhase = (typeof DAISY_PHASES)[number];

export const DAISY_BEATS = [
  'lookL',
  'lookR',
  'think',
  'check',
  'settle',
] as const;

export type DaisyBeat = (typeof DAISY_BEATS)[number];

export const DAISY_FOODS = [
  'beef',
  'chicken',
  'onion',
  'carrot',
  'garlic',
  'tomato',
  'salt',
  'chili',
] as const;

export type DaisyFoodId = (typeof DAISY_FOODS)[number];

export const DAISY_COPY_BUCKETS = [
  'idle',
  'importing',
  'analyzing',
  'extracting',
  'processing',
  'success',
  'error',
] as const;

export type DaisyCopyBucket = (typeof DAISY_COPY_BUCKETS)[number];

export const DAISY_COPY: Record<DaisyCopyBucket, readonly string[]> = {
  idle: ['Waiting for a recipe…'],
  importing: [
    'Fetching your recipe…',
    'Opening your link…',
    'Reading the post…',
    'Pulling in the recipe…',
    'Grabbing the good part…',
  ],
  analyzing: [
    'Reading the ingredients…',
    'Making sense of the steps…',
    'Sorting out what goes in…',
    'Checking the method…',
    'Reading it like a chef…',
  ],
  extracting: [
    'Finding every ingredient…',
    'Spotting the quantities…',
    'Separating spices from staples…',
    'Catching the small stuff…',
    'Nothing gets past Daisy…',
  ],
  processing: [
    'Measuring the quantities…',
    'Tidying the ingredient list…',
    'Putting steps in order…',
    'Converting measurements…',
    'Building your recipe…',
  ],
  success: [
    'Recipe ready to cook.',
    'All set — recipe saved.',
    'Done — looks delicious.',
    'Your recipe is ready.',
    'Saved to your library.',
  ],
  error: [
    "That link didn't want to cooperate.",
    "We couldn't read that one. Try again?",
    'Hmm, that recipe got away.',
    'Something went sideways — one more try?',
    "We couldn't finish this import.",
  ],
};

// The chips sit in a band directly above the cat. Horizontal placement keeps the
// lab's staggered diagonal; vertical offsets are measured from the band top so
// the lowest chip nearly touches Daisy's ears.
export const DAISY_CHIP_BAND = 100;
export const DAISY_CHIP_GAP = 4;

export const THEATER_CHIPS: readonly {
  id: DaisyFoodId;
  name: string;
  qty: string;
  x: `${number}%`;
  y: number;
}[] = [
  { id: 'beef', name: 'Beef', qty: '430 g', x: '2%', y: 14 },
  { id: 'onion', name: 'Onion', qty: '2', x: '54%', y: 0 },
  { id: 'carrot', name: 'Carrot', qty: '1 large', x: '48%', y: 62 },
];

const IMPORTING = new Set(['QUEUED', 'ACQUIRING_CONTENT', 'CONTENT_ACQUIRED']);

const PROCESSING = new Set(['NORMALIZING_RECIPE', 'VALIDATING_RECIPE']);

export function daisyPhaseFromJob(
  status?: string | null,
  currentStage?: string | null,
): DaisyPhase {
  if (!status) {
    return 'idle';
  }
  if (status === 'FAILED' || status === 'CANCELLED') {
    return 'error';
  }
  if (status === 'COMPLETED') {
    return 'success';
  }

  const stage = currentStage ?? status;
  if (IMPORTING.has(stage) || IMPORTING.has(status)) {
    return 'importing';
  }
  if (PROCESSING.has(stage) || PROCESSING.has(status)) {
    return 'processing';
  }
  return 'analyzing';
}

export function daisyCopyBucketFromJob(
  status?: string | null,
  currentStage?: string | null,
): DaisyCopyBucket {
  if (!status) {
    return 'idle';
  }
  if (status === 'FAILED' || status === 'CANCELLED') {
    return 'error';
  }
  if (status === 'COMPLETED') {
    return 'success';
  }

  const stage = currentStage ?? status;
  if (IMPORTING.has(stage) || IMPORTING.has(status)) {
    return 'importing';
  }
  if (stage === 'EXTRACTING_RECIPE' || status === 'EXTRACTING_RECIPE') {
    return 'extracting';
  }
  if (PROCESSING.has(stage) || PROCESSING.has(status)) {
    return 'processing';
  }
  return 'analyzing';
}

// While the signature intro is still playing, the copy has to follow the pose
// Daisy is actually holding rather than the stage the backend has reached.
export function daisyCopyBucketForPhase(
  phase: DaisyPhase,
  jobBucket: DaisyCopyBucket,
): DaisyCopyBucket {
  if (phase === 'idle') {
    return 'idle';
  }
  if (phase === 'importing') {
    return 'importing';
  }
  if (phase === 'analyzing') {
    return jobBucket === 'analyzing' || jobBucket === 'extracting'
      ? jobBucket
      : 'analyzing';
  }
  if (phase === 'processing') {
    return 'processing';
  }
  return phase;
}

export function formatSourcePill(url: string): string {
  const raw = url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (raw.length <= 28) {
    return raw;
  }
  return `${raw.slice(0, 20)}…${raw.slice(-3)}`;
}
