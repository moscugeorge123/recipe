/** Identity proven by a verified ID token. Provider-agnostic so the resolver never sees Firebase. */
export interface VerifiedIdentity {
  /** Stable account id (Firebase `uid`). Stored as `User.authSubject`. */
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  /** For example `password`, `google.com`, `facebook.com`. */
  signInProvider: string;
}

export interface TokenVerifier {
  /** Throws `UnauthorizedError` when the token is malformed, expired, revoked or forged. */
  verify(idToken: string): Promise<VerifiedIdentity>;
}

/** Removes the account from the identity provider when a user deletes their account. */
export interface AccountDeleter {
  deleteUser(uid: string): Promise<void>;
}
