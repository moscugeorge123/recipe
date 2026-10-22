/** The five failure screens a link import can end on. */
export type ImportErrorGroup =
  'not_recipe' | 'unsupported' | 'cant_open' | 'rate_limited' | 'generic';

/** What a button on the error card does. */
export type ImportErrorAction = 'retry' | 'another' | 'edit' | 'write' | 'scan';

/** Rate-limited retries stay locked this long (the API sends no retry-after). */
export const RATE_LIMIT_COUNTDOWN_S = 15;

const GROUP_BY_CODE: Record<string, ImportErrorGroup> = {
  NOT_A_RECIPE: 'not_recipe',
  UNSUPPORTED_SOURCE: 'unsupported',
  INVALID_URL: 'cant_open',
  HOST_NOT_FOUND: 'cant_open',
  BLOCKED: 'cant_open',
  NOT_FOUND: 'cant_open',
  CONTENT_ACQUISITION_FAILED: 'cant_open',
  TOO_MANY_REQUESTS: 'rate_limited',
  PROVIDER_RATE_LIMITED: 'rate_limited',
};

export function errorGroupOf(code: string | undefined): ImportErrorGroup {
  return (code && GROUP_BY_CODE[code]) || 'generic';
}

export type ImportErrorCopy = {
  /** Material Symbols name. */
  icon: string;
  /** Amber instead of terracotta. */
  warn: boolean;
  message: string;
  sub: string;
  primary: { label: string; action: ImportErrorAction };
  secondary: { label: string; action: ImportErrorAction };
};

/** What the error card says when the import was a photo, not a link. */
function scanErrorCopy(group: ImportErrorGroup): ImportErrorCopy {
  if (group === 'not_recipe') {
    return {
      icon: 'no_meals',
      warn: false,
      message: 'That photo doesn’t look like a recipe',
      sub: 'Fit the whole page in the frame and avoid glare.',
      primary: { label: 'Scan again', action: 'scan' },
      secondary: { label: 'Write it yourself', action: 'write' },
    };
  }
  return {
    icon: 'sentiment_dissatisfied',
    warn: group === 'rate_limited',
    message:
      group === 'rate_limited'
        ? 'That’s a lot of scans — wait a moment'
        : 'Couldn’t read a recipe from that photo',
    sub:
      group === 'rate_limited'
        ? 'Try again in a minute. Nothing was lost.'
        : 'Try again in good light with the page flat, or write it yourself.',
    primary: { label: 'Scan again', action: 'scan' },
    secondary: { label: 'Write it yourself', action: 'write' },
  };
}

/**
 * `source` is the platform name ("TikTok"); absent for plain websites. `scan` is for imports
 * that came from a photo.
 */
export function importErrorCopy(
  group: ImportErrorGroup,
  source?: string,
  scan = false,
): ImportErrorCopy {
  if (scan) return scanErrorCopy(group);
  switch (group) {
    case 'not_recipe':
      return {
        icon: 'no_meals',
        warn: false,
        message: 'That link doesn’t look like a food recipe',
        sub: 'Try a link to a recipe page or a cooking video.',
        primary: { label: 'Try another link', action: 'another' },
        secondary: { label: 'Write it yourself', action: 'write' },
      };
    case 'unsupported':
      return {
        icon: 'link_off',
        warn: false,
        message: `${source ? `${source} links` : 'That kind of link'} can’t be imported yet`,
        sub: 'Try a recipe website, Instagram or YouTube link — or scan a page instead.',
        primary: { label: 'Try another link', action: 'another' },
        secondary: { label: 'Scan a page', action: 'scan' },
      };
    case 'cant_open':
      return {
        icon: 'public_off',
        warn: false,
        message: 'We couldn’t reach that link — check it and try again',
        sub: 'The page may be private, or the address may have a typo.',
        primary: { label: 'Try again', action: 'retry' },
        secondary: { label: 'Edit link', action: 'edit' },
      };
    case 'rate_limited':
      return {
        icon: 'hourglass_top',
        warn: true,
        message: 'That source is busy — wait a moment and try again',
        sub: 'Too many people are asking at once. Nothing was lost.',
        primary: { label: 'Try again', action: 'retry' },
        secondary: { label: 'Edit link', action: 'edit' },
      };
    case 'generic':
      return {
        icon: 'sentiment_dissatisfied',
        warn: false,
        message: 'Couldn’t read a recipe from that link',
        sub: 'Something went wrong on our side. Try again, or write it yourself.',
        primary: { label: 'Try again', action: 'retry' },
        secondary: { label: 'Write it yourself', action: 'write' },
      };
  }
}

/** Whole seconds left on a rate-limit lock; 0 when free. */
export function retrySecondsLeft(
  retryAt: number | undefined,
  now: number,
): number {
  if (!retryAt) return 0;
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}
