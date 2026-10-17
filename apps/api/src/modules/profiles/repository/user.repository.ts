export interface UserRecord {
  id: string;
  authSubject: string | null;
  email: string | null;
  displayName: string | null;
  createdAt: Date;
}

/** Profile fields an identity provider asserts about a signed-in user. */
export interface UserIdentityInput {
  authSubject: string;
  email?: string;
  displayName?: string;
}

export interface IUserRepository {
  /**
   * Returns the user for this account, creating it (with the default categories) on first
   * sight. Safe to call concurrently for the same account. Provider email/name changes are
   * copied over, but never cleared and never allowed to fail the call.
   */
  findOrCreateByAuthSubject(identity: UserIdentityInput): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  /** Deletes the user and, through cascading relations, everything they own. */
  deleteById(id: string): Promise<boolean>;
}
