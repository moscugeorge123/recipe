import { UnauthorizedError } from '../../shared/errors/app-error.js';
import type { AccountDeleter, TokenVerifier, VerifiedIdentity } from './token-verifier.js';

const PREFIX = 'test';

/** Builds a token the {@link FakeTokenVerifier} accepts: `test:<uid>[:<email>[:<name>]]`. */
export function fakeIdToken(uid: string, email?: string, name?: string): string {
  return [
    PREFIX,
    uid,
    ...(email !== undefined ? [email] : []),
    ...(name !== undefined ? [name] : []),
  ].join(':');
}

/** `Authorization` header value for {@link fakeIdToken}. */
export function fakeBearer(uid: string, email?: string, name?: string): string {
  return `Bearer ${fakeIdToken(uid, email, name)}`;
}

/**
 * Test double that trusts the token text instead of checking a signature. Never wire it into a
 * real container: it is only reachable through test helpers.
 */
export class FakeTokenVerifier implements TokenVerifier {
  verify(idToken: string): Promise<VerifiedIdentity> {
    const [prefix, uid, email, name] = idToken.split(':');
    if (prefix !== PREFIX || uid === undefined || uid === '') {
      return Promise.reject(
        new UnauthorizedError({ message: 'Invalid or expired authentication token' }),
      );
    }

    return Promise.resolve({
      uid,
      emailVerified: email !== undefined && email !== '',
      signInProvider: 'password',
      ...(email !== undefined && email !== '' ? { email } : {}),
      ...(name !== undefined && name !== '' ? { name } : {}),
    });
  }
}

/** Records deletions instead of calling Firebase. */
export class FakeAccountDeleter implements AccountDeleter {
  readonly deleted: string[] = [];

  deleteUser(uid: string): Promise<void> {
    this.deleted.push(uid);
    return Promise.resolve();
  }
}
