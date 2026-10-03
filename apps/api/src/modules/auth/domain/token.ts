/**
 * Verified caller identity. The UID always comes from a checked token, never from a request body.
 */
export interface VerifiedIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  /** Firebase `auth_time`, seconds since epoch. */
  authTime: number;
  /** Token `exp`, seconds since epoch. */
  expiresAt: number;
  signInProvider: string;
  providers: string[];
}

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<VerifiedIdentity>;
}

export interface AppCheckVerifier {
  verify(token: string): Promise<{ appId: string }>;
}

/**
 * Privileged identity operations. `deleteUser` is idempotent when the account is already gone.
 * `getProviders` returns null when Firebase has no such user.
 */
export interface IdentityAdmin {
  deleteUser(uid: string): Promise<void>;
  getProviders(uid: string): Promise<string[] | null>;
}

/** Used when account deletion has no live Firebase project (tests, HMAC mode). */
export class NoopIdentityAdmin implements IdentityAdmin {
  async deleteUser(_uid: string): Promise<void> {}

  async getProviders(_uid: string): Promise<string[] | null> {
    return null;
  }
}
