import { tNow } from '@/i18n/format';
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
      message: tNow('err.scanNotRecipe'),
      sub: tNow('err.scanNotRecipeSub'),
      primary: { label: tNow('imports.scanAgain'), action: 'scan' },
      secondary: { label: tNow('add.writeItYourself'), action: 'write' },
    };
  }
  return {
    icon: 'sentiment_dissatisfied',
    warn: group === 'rate_limited',
    message:
      group === 'rate_limited' ? tNow('err.scanBusy') : tNow('err.scanGeneric'),
    sub:
      group === 'rate_limited'
        ? tNow('err.scanBusySub')
        : tNow('err.scanGenericSub'),
    primary: { label: tNow('imports.scanAgain'), action: 'scan' },
    secondary: { label: tNow('add.writeItYourself'), action: 'write' },
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
        message: tNow('err.notRecipe'),
        sub: tNow('err.notRecipeSub'),
        primary: { label: tNow('err.tryAnother'), action: 'another' },
        secondary: { label: tNow('add.writeItYourself'), action: 'write' },
      };
    case 'unsupported':
      return {
        icon: 'link_off',
        warn: false,
        message: source
          ? tNow('err.unsupportedLinks', { source })
          : tNow('err.unsupportedKind'),
        sub: tNow('err.unsupportedSub'),
        primary: { label: tNow('err.tryAnother'), action: 'another' },
        secondary: { label: tNow('common.scanAPage'), action: 'scan' },
      };
    case 'cant_open':
      return {
        icon: 'public_off',
        warn: false,
        message: tNow('err.cantOpen'),
        sub: tNow('err.cantOpenSub'),
        primary: { label: tNow('recipe.translationRetry'), action: 'retry' },
        secondary: { label: tNow('err.editLink'), action: 'edit' },
      };
    case 'rate_limited':
      return {
        icon: 'hourglass_top',
        warn: true,
        message: tNow('err.busy'),
        sub: tNow('err.busySub'),
        primary: { label: tNow('recipe.translationRetry'), action: 'retry' },
        secondary: { label: tNow('err.editLink'), action: 'edit' },
      };
    case 'generic':
      return {
        icon: 'sentiment_dissatisfied',
        warn: false,
        message: tNow('err.generic'),
        sub: tNow('err.genericSub'),
        primary: { label: tNow('recipe.translationRetry'), action: 'retry' },
        secondary: { label: tNow('add.writeItYourself'), action: 'write' },
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
