import { tNow } from '@/i18n/format';
import { ApiError } from '@/services/api-client';

export type UserErrorContext =
  | 'generic'
  | 'import'
  | 'preview'
  | 'home'
  | 'recipe'
  | 'pantry'
  | 'shopping'
  | 'mealPlan'
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
    get title() {
      return tNow('ue.slowDownASecond');
    },
    get message() {
      return tNow('ue.thatSourceIsBusy');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  PROVIDER_RATE_LIMITED: {
    get title() {
      return tNow('ue.slowDownASecond');
    },
    get message() {
      return tNow('ue.thatSourceIsBusy');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    get title() {
      return tNow('ue.takingAShortBreather');
    },
    get message() {
      return tNow('ue.tryAgainInA');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  INTERNAL_SERVER_ERROR: {
    get title() {
      return tNow('ue.somethingWentSideways');
    },
    get message() {
      return tNow('ue.tryAgainYourInput');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  UNSUPPORTED_SOURCE: {
    get title() {
      return tNow('ue.thatSourceIsntSupported');
    },
    get message() {
      return tNow('ue.tryARecipeWebsite');
    },
    get actionLabel() {
      return tNow('ue.pasteADifferentLink');
    },
    retryable: false,
  },
  INVALID_URL: {
    get title() {
      return tNow('ue.thatDoesntLookLike');
    },
    get message() {
      return tNow('ue.checkTheAddressAnd');
    },
    get actionLabel() {
      return tNow('ue.pasteADifferentLink');
    },
    retryable: false,
  },
  HOST_NOT_FOUND: {
    get title() {
      return tNow('ue.weCouldntFindThat');
    },
    get message() {
      return tNow('ue.checkTheAddressAnd');
    },
    get actionLabel() {
      return tNow('ue.pasteADifferentLink');
    },
    retryable: false,
  },
  BLOCKED: {
    get title() {
      return tNow('ue.thatSiteWontLet');
    },
    get message() {
      return tNow('ue.itBlocksAutomatedReaders');
    },
    get actionLabel() {
      return tNow('ue.pasteADifferentLink');
    },
    retryable: false,
  },
  NOT_A_RECIPE: {
    get title() {
      return tNow('ue.thatLinkDoesntLook');
    },
    get message() {
      return tNow('ue.tryALinkTo');
    },
    get actionLabel() {
      return tNow('ue.pasteADifferentLink');
    },
    retryable: false,
  },
  EXTRACTION_FAILED: {
    get title() {
      return tNow('ue.weCouldntReadThat');
    },
    get message() {
      return tNow('ue.theExtractionFailedCheck');
    },
    get actionLabel() {
      return tNow('ue.tryAgain');
    },
    retryable: true,
  },
  CONTENT_ACQUISITION_FAILED: {
    get title() {
      return tNow('ue.weCouldntOpenThat');
    },
    get message() {
      return tNow('ue.checkTheLinkAnd');
    },
    get actionLabel() {
      return tNow('ue.tryAgain');
    },
    retryable: true,
  },
  MEDIA_PROCESSING_FAILED: {
    get title() {
      return tNow('ue.weCouldntUseThat');
    },
    get message() {
      return tNow('ue.tryAnotherPhotoOr');
    },
    get actionLabel() {
      return tNow('ue.tryAgain');
    },
    retryable: true,
  },
  JOB_CANCELLED: {
    get title() {
      return tNow('ue.importStopped');
    },
    get message() {
      return tNow('ue.nothingWasSavedStart');
    },
    get actionLabel() {
      return tNow('ue.tryAgain');
    },
    retryable: true,
  },
  JOB_NOT_FOUND: {
    get title() {
      return tNow('ue.thatImportExpired');
    },
    get message() {
      return tNow('ue.startANewImport');
    },
    get actionLabel() {
      return tNow('ue.tryAgain');
    },
    retryable: true,
  },
  NOT_FOUND: {
    get title() {
      return tNow('ue.weCouldntFindThat2');
    },
    get message() {
      return tNow('ue.itMayHaveBeen');
    },
    get actionLabel() {
      return tNow('ue.goBack');
    },
    retryable: false,
  },
  RECIPE_NOT_FOUND: {
    get title() {
      return tNow('ue.thatRecipeIsntHere');
    },
    get message() {
      return tNow('ue.itMayHaveBeen2');
    },
    get actionLabel() {
      return tNow('ue.goBack');
    },
    retryable: false,
  },
  COLLECTION_NOT_FOUND: {
    get title() {
      return tNow('ue.thatCollectionIsntHere');
    },
    get message() {
      return tNow('ue.recipesAreStillIn');
    },
    get actionLabel() {
      return tNow('ue.backToKitchen');
    },
    retryable: false,
  },
  COLLECTION_NAME_CONFLICT: {
    get title() {
      return tNow('ue.nameAlreadyUsed');
    },
    get message() {
      return tNow('ue.youAlreadyHaveA');
    },
    get actionLabel() {
      return tNow('ue.editName');
    },
    retryable: false,
  },
  COLLECTION_RECIPE_CONFLICT: {
    get title() {
      return tNow('ue.alreadyInThatCollection');
    },
    get message() {
      return tNow('ue.thisRecipeIsAlready');
    },
    get actionLabel() {
      return tNow('ue.ok');
    },
    retryable: false,
  },
  RECIPE_REVISION_CONFLICT: {
    get title() {
      return tNow('ue.thisRecipeChangedElsewhere');
    },
    get message() {
      return tNow('ue.yourDraftIsSafe');
    },
    get actionLabel() {
      return tNow('ue.reviewChanges');
    },
    retryable: false,
  },
  RECIPE_ENGAGEMENT_CONFLICT: {
    get title() {
      return tNow('ue.thatDidntStick');
    },
    get message() {
      return tNow('ue.theRecipeChangedTry');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  RECIPE_NOTE_NOT_FOUND: {
    get title() {
      return tNow('ue.thatNoteIsGone');
    },
    get message() {
      return tNow('ue.itMayAlreadyHave');
    },
    get actionLabel() {
      return tNow('ue.ok');
    },
    retryable: false,
  },
  VALIDATION_ERROR: {
    get title() {
      return tNow('ue.checkThatField');
    },
    get message() {
      return tNow('ue.somethingInThisForm');
    },
    get actionLabel() {
      return tNow('ue.edit');
    },
    retryable: false,
  },
  BAD_REQUEST: {
    get title() {
      return tNow('ue.checkThatField');
    },
    get message() {
      return tNow('ue.somethingInThisForm');
    },
    get actionLabel() {
      return tNow('ue.edit');
    },
    retryable: false,
  },
  CONFLICT: {
    get title() {
      return tNow('ue.thatNameIsTaken');
    },
    get message() {
      return tNow('ue.tryASlightlyDifferent');
    },
    get actionLabel() {
      return tNow('ue.edit');
    },
    retryable: false,
  },
  PAYLOAD_TOO_LARGE: {
    get title() {
      return tNow('ue.thatsABitMuch');
    },
    get message() {
      return tNow('ue.tryAShorterList');
    },
    get actionLabel() {
      return tNow('ue.edit');
    },
    retryable: false,
  },
};

const CONTEXT_FALLBACK: Record<UserErrorContext, Copy> = {
  generic: {
    get title() {
      return tNow('ue.couldntFinishThat');
    },
    get message() {
      return tNow('ue.checkYourConnectionAnd');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  import: {
    get title() {
      return tNow('ue.weCouldntReadThat');
    },
    get message() {
      return tNow('ue.theExtractionFailedCheck');
    },
    get actionLabel() {
      return tNow('ue.tryAgain');
    },
    retryable: true,
  },
  preview: {
    get title() {
      return tNow('ue.previewUnavailable');
    },
    get message() {
      return tNow('ue.weCouldntUnfurlThis');
    },
    get actionLabel() {
      return tNow('ue.retryPreview');
    },
    retryable: true,
  },
  home: {
    get title() {
      return tNow('ue.thisSectionDidntLoad');
    },
    get message() {
      return tNow('ue.weCouldntLoadThis');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  recipe: {
    get title() {
      return tNow('ue.recipe');
    },
    get message() {
      return tNow('ue.weCouldntLoadThis2');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  pantry: {
    get title() {
      return tNow('ue.pantry');
    },
    get message() {
      return tNow('ue.couldNotOrganizeRight');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  shopping: {
    get title() {
      return tNow('ue.groceryList');
    },
    get message() {
      return tNow('ue.couldNotUpdateYour');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  mealPlan: {
    get title() {
      return tNow('ue.mealPlan');
    },
    get message() {
      return tNow('ue.couldNotUpdateYour2');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  notes: {
    get title() {
      return tNow('ue.notes');
    },
    get message() {
      return tNow('ue.couldntSaveThisNote');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
    retryable: true,
  },
  collections: {
    get title() {
      return tNow('ue.collections');
    },
    get message() {
      return tNow('ue.couldNotSaveThat');
    },
    get actionLabel() {
      return tNow('ue.retry');
    },
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

/**
 * The error code to show for a failed import request. The API answers `INVALID_URL` both for
 * a malformed link and for a domain that does not resolve; the second reads differently
 * ("We couldn't find that site"), so it gets its own code.
 */
export function importErrorCodeOf(error: unknown): string | undefined {
  const code = errorCodeOf(error);
  if (
    code === 'INVALID_URL' &&
    error instanceof Error &&
    /resolve/i.test(error.message)
  ) {
    return 'HOST_NOT_FOUND';
  }
  return code;
}

/**
 * Toast for a failed link import: one or two lines (about 90 characters at most). `code` is
 * the API error code, from a thrown `ApiError` or the failed job's `error.code`.
 */
export function importFailureToast(
  code: string | undefined,
  source?: string,
  fallback = 'Couldn’t read a recipe from that link',
): string {
  switch (code) {
    case 'NOT_A_RECIPE':
      return 'That link doesn’t look like a food recipe';
    case 'UNSUPPORTED_SOURCE':
      return `${source ? `${source} links` : 'That kind of link'} can’t be imported yet — try a recipe website, Instagram or YouTube`;
    case 'INVALID_URL':
      return 'That doesn’t look like a valid link — check the address';
    case 'HOST_NOT_FOUND':
      return 'We couldn’t find that site. Check the address and try again';
    case 'BLOCKED':
      return 'That site won’t let us read it — try another link';
    case 'NOT_FOUND':
      return 'That page isn’t there any more — check the link';
    case 'CONTENT_ACQUISITION_FAILED':
      return 'We couldn’t reach that link — check it and try again';
    case 'TOO_MANY_REQUESTS':
    case 'PROVIDER_RATE_LIMITED':
      return 'That source is busy — wait a moment and try again';
    default:
      return fallback;
  }
}

/** Toast for a failed photo import, in the same one-or-two-line size as `importFailureToast`. */
export function scanFailureToast(code: string | undefined): string {
  switch (code) {
    case 'NOT_A_RECIPE':
      return 'That photo doesn’t look like a recipe — try a clearer shot';
    case 'PAYLOAD_TOO_LARGE':
      return 'That photo is too large — try a smaller one';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Use a JPEG, PNG or WebP photo';
    case 'PHOTO_UNREADABLE':
      return 'We couldn’t open that photo — try taking it again';
    case 'TOO_MANY_REQUESTS':
    case 'PROVIDER_RATE_LIMITED':
      return 'That’s a lot of scans — wait a moment and try again';
    default:
      return 'Couldn’t read a recipe from that photo — try again in good light';
  }
}

export function importErrorCopy(
  code: string | undefined,
  source?: string,
): UserFacingError {
  const mapped = mapUserError(code ?? 'EXTRACTION_FAILED', 'import', {
    log: false,
  });
  if (code === 'UNSUPPORTED_SOURCE' && source) {
    return {
      ...mapped,
      title: `${source} links aren’t supported yet`,
    };
  }
  return mapped;
}
