import {
  DAISY_COPY,
  daisyCopyBucketForPhase,
  daisyCopyBucketFromJob,
  daisyPhaseFromJob,
  formatSourcePill,
} from '@/components/daisy/phase';
import { daisyPose } from '@/components/daisy/pose';

describe('daisyPhaseFromJob', () => {
  test('maps job statuses onto mascot phases', () => {
    expect(daisyPhaseFromJob()).toBe('idle');
    expect(daisyPhaseFromJob('QUEUED', null)).toBe('importing');
    expect(daisyPhaseFromJob('ACQUIRING_CONTENT', 'ACQUIRING_CONTENT')).toBe(
      'importing',
    );
    expect(daisyPhaseFromJob('CONTENT_ACQUIRED', 'CONTENT_ACQUIRED')).toBe(
      'importing',
    );
    expect(daisyPhaseFromJob('TRANSCRIBING', 'TRANSCRIBING')).toBe('analyzing');
    expect(daisyPhaseFromJob('EXTRACTING_RECIPE', 'EXTRACTING_RECIPE')).toBe(
      'analyzing',
    );
    expect(daisyPhaseFromJob('NORMALIZING_RECIPE', 'NORMALIZING_RECIPE')).toBe(
      'processing',
    );
    expect(daisyPhaseFromJob('VALIDATING_RECIPE', 'VALIDATING_RECIPE')).toBe(
      'processing',
    );
    expect(daisyPhaseFromJob('COMPLETED', 'VALIDATING_RECIPE')).toBe('success');
    expect(daisyPhaseFromJob('FAILED', 'EXTRACTING_RECIPE')).toBe('error');
    expect(daisyPhaseFromJob('CANCELLED', null)).toBe('error');
  });
});

describe('daisyCopyBucketFromJob', () => {
  test('keeps extracting copy on the analyzing pose', () => {
    expect(
      daisyCopyBucketFromJob('EXTRACTING_RECIPE', 'EXTRACTING_RECIPE'),
    ).toBe('extracting');
    expect(daisyPhaseFromJob('EXTRACTING_RECIPE', 'EXTRACTING_RECIPE')).toBe(
      'analyzing',
    );
    expect(DAISY_COPY.extracting).toContain('Nothing gets past Daisy…');
  });

  test('maps the other pipeline buckets', () => {
    expect(daisyCopyBucketFromJob('QUEUED', null)).toBe('importing');
    expect(daisyCopyBucketFromJob('TRANSCRIBING', 'TRANSCRIBING')).toBe(
      'analyzing',
    );
    expect(
      daisyCopyBucketFromJob('NORMALIZING_RECIPE', 'NORMALIZING_RECIPE'),
    ).toBe('processing');
    expect(daisyCopyBucketFromJob('COMPLETED', null)).toBe('success');
    expect(daisyCopyBucketFromJob('FAILED', null)).toBe('error');
  });
});

describe('daisyCopyBucketForPhase', () => {
  test('follows the held pose while the intro plays', () => {
    expect(daisyCopyBucketForPhase('idle', 'extracting')).toBe('idle');
    expect(daisyCopyBucketForPhase('importing', 'extracting')).toBe(
      'importing',
    );
  });

  test('keeps the extracting lines once Daisy is analyzing', () => {
    expect(daisyCopyBucketForPhase('analyzing', 'extracting')).toBe(
      'extracting',
    );
    expect(daisyCopyBucketForPhase('analyzing', 'processing')).toBe(
      'analyzing',
    );
    expect(daisyCopyBucketForPhase('processing', 'processing')).toBe(
      'processing',
    );
    expect(daisyCopyBucketForPhase('success', 'success')).toBe('success');
    expect(daisyCopyBucketForPhase('error', 'error')).toBe('error');
  });
});

describe('formatSourcePill', () => {
  test('strips the scheme and shortens long paths', () => {
    expect(formatSourcePill('https://instagram.com/reel/abc')).toBe(
      'instagram.com/reel/abc',
    );
    expect(
      formatSourcePill('https://instagram.com/reel/DKxVeryLongId4f2'),
    ).toMatch(/instagram\.com\/reel\/.+…4f2/);
  });
});

describe('daisyPose', () => {
  test('wears glasses only while analyzing or processing', () => {
    expect(daisyPose('idle', 'settle').glasses).toBe(false);
    expect(daisyPose('importing', 'settle').glasses).toBe(false);
    expect(daisyPose('analyzing', 'settle').glasses).toBe(true);
    expect(daisyPose('processing', 'settle').glasses).toBe(true);
    expect(daisyPose('success', 'settle').glasses).toBe(false);
    expect(daisyPose('error', 'settle').glasses).toBe(false);
  });

  test('think beat raises a paw and thought dots', () => {
    const think = daisyPose('analyzing', 'think');
    expect(think.paw).toBe('chin');
    expect(think.dots).toBe(true);
    expect(think.mouth).toBe('hmm');
  });
});
