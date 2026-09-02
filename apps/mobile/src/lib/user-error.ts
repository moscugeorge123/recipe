import { ApiError } from '@/services/api-client';

export type UserErrorContext =
  | 'generic'
  | 'import'
  | 'preview'
  | 'home'
  | 'recipe'
  | 'nutrition'
  | 'pantry'
  | 'notes'
  | 'collections';

export type UserFacingError = {
  title: string;
  message: string;
  actionLabel: string;
  retryable: boolean;
  code?: string;
};

type Copy = Omit<UserFacingError, 'code'>;

const CODE_COPY: Record<string, Copy> = {
  TOO_MANY_REQUESTS: {
    title: 'Slow down a second',
    message: 'That source is busy. Wait a moment and try again.',
    actionLabel: 'Retry',
    retryable: true,
  },
  PROVIDER_RATE_LIMITED: {
    title: 'Slow down a second',
    message: 'That source is busy. Wait a moment and try again.',
    actionLabel: 'Retry',
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    title: 'Taking a short breather',
    message: 'Try again in a moment. Nothing you typed was lost.',
    actionLabel: 'Retry',
    retryable: true,
  },
  INTERNAL_SERVER_ERROR: {
    title: 'Something went sideways',
    message: 'Try again. Your input is still here.',
    actionLabel: 'Retry',
    retryable: true,
  },
  UNSUPPORTED_SOURCE: {
    title: 'This video is private',
    message:
      'That source isn’t available yet — or the link is locked. Try a website, Instagram or YouTube URL.',
    actionLabel: 'Paste a different link',
    retryable: false,
  },
  INVALID_URL: {
    title: 'This video is private',
    message:
      'That source isn’t available yet — or the link is locked. Try a website, Instagram or YouTube URL.',
    actionLabel: 'Paste a different link',
    retryable: false,
  },
  EXTRACTION_FAILED: {
    title: "We couldn't read that one. Try again?",
    message: 'The extraction failed. Check the link and try again.',
    actionLabel: 'Try again',
    retryable: true,
  },
  CONTENT_ACQUISITION_FAILED: {
    title: "We couldn't open that link",
    message: 'Check the link and try again, or paste a different one.',
    actionLabel: 'Try again',
    retryable: true,
  },
  MEDIA_PROCESSING_FAILED: {
    title: "We couldn't use that media",
    message: 'Try another photo or link. Your other options are still here.',
    actionLabel: 'Try again',
    retryable: true,
  },
  JOB_CANCELLED: {
    title: 'Import stopped',
    message: 'Nothing was saved. Start again when you’re ready.',
    actionLabel: 'Try again',
    retryable: true,
  },
  JOB_NOT_FOUND: {
    title: 'That import expired',
    message: 'Start a new import from the link you wanted.',
    actionLabel: 'Try again',
    retryable: true,
  },
  NOT_FOUND: {
    title: 'We couldn’t find that',
    message: 'It may have been removed. Go back and pick something else.',
    actionLabel: 'Go back',
    retryable: false,
  },
  RECIPE_NOT_FOUND: {
    title: 'That recipe isn’t here',
    message: 'It may have been removed. Go back to your kitchen.',
    actionLabel: 'Go back',
    retryable: false,
  },
  COLLECTION_NOT_FOUND: {
    title: 'That collection isn’t here',
    message: 'Recipes are still in your kitchen. Go back and pick another.',
    actionLabel: 'Back to kitchen',
    retryable: false,
  },
  COLLECTION_NAME_CONFLICT: {
    title: 'Name already used',
    message: 'You already have a collection with that name.',
    actionLabel: 'Edit name',
    retryable: false,
  },
  COLLECTION_RECIPE_CONFLICT: {
    title: 'Already in that collection',
    message: 'This recipe is already filed there.',
    actionLabel: 'OK',
    retryable: false,
  },
  RECIPE_REVISION_CONFLICT: {
    title: 'This recipe changed elsewhere',
    message: 'Your draft is safe — choose how to continue.',
    actionLabel: 'Review changes',
    retryable: false,
  },
  RECIPE_ENGAGEMENT_CONFLICT: {
    title: 'That didn’t stick',
    message: 'The recipe changed. Try the heart or stars again.',
    actionLabel: 'Retry',
    retryable: true,
  },
  RECIPE_NOTE_NOT_FOUND: {
    title: 'That note is gone',
    message:
      'It may already have been deleted. Your other notes are still here.',
    actionLabel: 'OK',
    retryable: false,
  },
  VALIDATION_ERROR: {
    title: 'Check that field',
    message: 'Something in this form needs a quick look.',
    actionLabel: 'Edit',
    retryable: false,
  },
  BAD_REQUEST: {
    title: 'Check that field',
    message: 'Something in this form needs a quick look.',
    actionLabel: 'Edit',
    retryable: false,
  },
  CONFLICT: {
    title: 'That name is taken',
    message: 'Try a slightly different name.',
    actionLabel: 'Edit',
    retryable: false,
  },
  PAYLOAD_TOO_LARGE: {
    title: 'That’s a bit much',
    message: 'Try a shorter list or a smaller photo.',
    actionLabel: 'Edit',
    retryable: false,
  },
};

const CONTEXT_FALLBACK: Record<UserErrorContext, Copy> = {
  generic: {
    title: 'Couldn’t finish that',
    message: 'Check your connection and try again. Nothing you typed was lost.',
    actionLabel: 'Retry',
    retryable: true,
  },
  import: {
    title: "We couldn't read that one. Try again?",
    message: 'The extraction failed. Check the link and try again.',
    actionLabel: 'Try again',
    retryable: true,
  },
  preview: {
    title: 'Preview unavailable',
    message:
      "We couldn't unfurl this link. You can still turn it into a recipe.",
    actionLabel: 'Retry preview',
    retryable: true,
  },
  home: {
    title: 'This section didn’t load',
    message:
      'We couldn’t load this section. Check your connection and try again.',
    actionLabel: 'Retry',
    retryable: true,
  },
  recipe: {
    title: 'Recipe',
    message:
      'We couldn’t load this recipe. Check your connection and try again.',
    actionLabel: 'Retry',
    retryable: true,
  },
  nutrition: {
    title: 'Nutrition',
    message: 'We couldn’t load nutrition. The recipe is still here.',
    actionLabel: 'Retry',
    retryable: true,
  },
  pantry: {
    title: 'Pantry',
    message: 'Could not organize right now. Your text is still here.',
    actionLabel: 'Retry',
    retryable: true,
  },
  notes: {
    title: 'Notes',
    message: 'Couldn’t save this note. It’s still here — try again.',
    actionLabel: 'Retry',
    retryable: true,
  },
  collections: {
    title: 'Collections',
    message: 'Could not save that collection. Try again.',
    actionLabel: 'Retry',
    retryable: true,
  },
};

export function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}

export function errorCodeOf(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.code;
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function logApiError(error: unknown, context: string): void {
  if (isAbortError(error)) {
    return;
  }
  if (error instanceof ApiError) {
    console.warn('[api]', {
      context,
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      retryable: error.retryable,
    });
    return;
  }
  const code = errorCodeOf(error);
  console.warn('[api]', {
    context,
    ...(code ? { code } : {}),
    message: error instanceof Error ? error.message : undefined,
  });
}

export function mapUserError(
  error: unknown,
  context: UserErrorContext = 'generic',
  options: { log?: boolean } = {},
): UserFacingError {
  if (options.log !== false) {
    logApiError(error, context);
  }
  const code = errorCodeOf(error);
  const fromCode = code ? CODE_COPY[code] : undefined;
  if (fromCode) {
    return { ...fromCode, code };
  }

  const fallback = CONTEXT_FALLBACK[context];
  return {
    ...fallback,
    code,
    retryable: error instanceof ApiError ? error.retryable : fallback.retryable,
  };
}

export function importErrorCopy(
  code: string | undefined,
  source?: string,
): UserFacingError {
  const mapped = mapUserError(code ?? 'EXTRACTION_FAILED', 'import', {
    log: false,
  });
  if ((code === 'UNSUPPORTED_SOURCE' || code === 'INVALID_URL') && source) {
    return {
      ...mapped,
      message: `${source} isn’t available yet — or the link is locked. Try a website, Instagram or YouTube URL.`,
    };
  }
  return mapped;
}
