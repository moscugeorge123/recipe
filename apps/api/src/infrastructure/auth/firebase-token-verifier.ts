import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { UnauthorizedError } from '../../shared/errors/app-error.js';
import type { AccountDeleter, TokenVerifier, VerifiedIdentity } from './token-verifier.js';

export interface FirebaseTokenVerifierOptions {
  /** Only effective with a service account: revocation is checked against the Firebase backend. */
  checkRevoked?: boolean;
}

/** Verifies Firebase ID tokens (signature, audience, issuer, expiry) with `firebase-admin`. */
export class FirebaseTokenVerifier implements TokenVerifier {
  private readonly checkRevoked: boolean;

  constructor(
    private readonly app: App,
    options: FirebaseTokenVerifierOptions = {},
  ) {
    this.checkRevoked = options.checkRevoked ?? false;
  }

  async verify(idToken: string): Promise<VerifiedIdentity> {
    try {
      const decoded = await getAuth(this.app).verifyIdToken(idToken, this.checkRevoked);

      return {
        uid: decoded.uid,
        emailVerified: decoded.email_verified === true,
        signInProvider: decoded.firebase.sign_in_provider,
        ...(decoded.email !== undefined ? { email: decoded.email } : {}),
        ...(typeof decoded.name === 'string' ? { name: decoded.name } : {}),
        ...(typeof decoded.picture === 'string' ? { picture: decoded.picture } : {}),
      };
    } catch {
      // The cause (expired, wrong audience, revoked, ...) is deliberately not exposed to callers.
      throw new UnauthorizedError({ message: 'Invalid or expired authentication token' });
    }
  }
}

/** Deletes the Firebase user. Requires the app to be initialised with a service account. */
export class FirebaseAccountDeleter implements AccountDeleter {
  constructor(private readonly app: App) {}

  async deleteUser(uid: string): Promise<void> {
    try {
      await getAuth(this.app).deleteUser(uid);
    } catch (error) {
      // Already gone (for example the client deleted it first) is the desired end state.
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        return;
      }
      throw error;
    }
  }
}
