import { AuthErrorCode } from '@recipe/contracts';

import { AuthAppError } from '../../../shared/errors/app-error.js';
import type { AppCheckVerifier, TokenVerifier, VerifiedIdentity } from '../domain/token.js';

/** Used when no Firebase project and no non-production HMAC secret are configured. */
export class RejectingTokenVerifier implements TokenVerifier {
  async verifyIdToken(_token: string): Promise<VerifiedIdentity> {
    throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
  }
}

export class RejectingAppCheckVerifier implements AppCheckVerifier {
  async verify(_token: string): Promise<{ appId: string }> {
    throw new AuthAppError(AuthErrorCode.AUTH_APP_CHECK_FAILED);
  }
}
