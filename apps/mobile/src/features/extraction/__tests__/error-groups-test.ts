import {
  RATE_LIMIT_COUNTDOWN_S,
  errorGroupOf,
  importErrorCopy,
  retrySecondsLeft,
} from '@/features/extraction/error-groups';

describe('import error groups', () => {
  test('maps backend codes onto the five groups', () => {
    expect(errorGroupOf('NOT_A_RECIPE')).toBe('not_recipe');
    expect(errorGroupOf('UNSUPPORTED_SOURCE')).toBe('unsupported');
    expect(errorGroupOf('INVALID_URL')).toBe('cant_open');
    expect(errorGroupOf('HOST_NOT_FOUND')).toBe('cant_open');
    expect(errorGroupOf('BLOCKED')).toBe('cant_open');
    expect(errorGroupOf('NOT_FOUND')).toBe('cant_open');
    expect(errorGroupOf('CONTENT_ACQUISITION_FAILED')).toBe('cant_open');
    expect(errorGroupOf('TOO_MANY_REQUESTS')).toBe('rate_limited');
    expect(errorGroupOf('PROVIDER_RATE_LIMITED')).toBe('rate_limited');
  });

  test('anything else is generic', () => {
    expect(errorGroupOf('EXTRACTION_FAILED')).toBe('generic');
    expect(errorGroupOf('LOST_TRACK')).toBe('generic');
    expect(errorGroupOf(undefined)).toBe('generic');
  });

  test('each group has an icon and two actions', () => {
    expect(importErrorCopy('not_recipe').icon).toBe('no_meals');
    expect(importErrorCopy('unsupported').icon).toBe('link_off');
    expect(importErrorCopy('cant_open').icon).toBe('public_off');
    expect(importErrorCopy('rate_limited').icon).toBe('hourglass_top');
    expect(importErrorCopy('generic').icon).toBe('sentiment_dissatisfied');
    expect(importErrorCopy('rate_limited').warn).toBe(true);
    expect(importErrorCopy('generic').warn).toBe(false);
    expect(importErrorCopy('not_recipe').secondary.action).toBe('write');
    expect(importErrorCopy('unsupported').secondary.action).toBe('scan');
    expect(importErrorCopy('cant_open').secondary.action).toBe('edit');
  });

  test('names the platform in the unsupported message', () => {
    expect(importErrorCopy('unsupported', 'TikTok').message).toBe(
      'TikTok links can’t be imported yet',
    );
    expect(importErrorCopy('unsupported').message).toBe(
      'That kind of link can’t be imported yet',
    );
  });

  test('rate-limit countdown rounds up and bottoms out at zero', () => {
    const t0 = 1_000_000;
    const retryAt = t0 + RATE_LIMIT_COUNTDOWN_S * 1000;
    expect(RATE_LIMIT_COUNTDOWN_S).toBe(15);
    expect(retrySecondsLeft(retryAt, t0)).toBe(15);
    expect(retrySecondsLeft(retryAt, t0 + 14_200)).toBe(1);
    expect(retrySecondsLeft(retryAt, t0 + 15_000)).toBe(0);
    expect(retrySecondsLeft(retryAt, t0 + 60_000)).toBe(0);
    expect(retrySecondsLeft(undefined, t0)).toBe(0);
  });
});

describe('photo import error copy', () => {
  test('talks about the photo, never a link', () => {
    for (const group of [
      'not_recipe',
      'unsupported',
      'cant_open',
      'rate_limited',
      'generic',
    ] as const) {
      const copy = importErrorCopy(group, undefined, true);
      expect(`${copy.message} ${copy.sub}`).not.toMatch(/link/i);
      expect(copy.primary.action).toBe('scan');
      expect(copy.secondary.action).toBe('write');
    }
    expect(importErrorCopy('not_recipe', undefined, true).message).toBe(
      'That photo doesn’t look like a recipe',
    );
  });
});
