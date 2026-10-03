import { AuthErrorCode, type ApplicationUser } from '@recipe/contracts';

import { AuthAppError, UnauthorizedError } from '../../../shared/errors/app-error.js';
import type { AuthService } from '../../auth/application/auth-service.js';
import type { AppCheckVerifier, TokenVerifier, VerifiedIdentity } from '../../auth/domain/token.js';
import {
  type ProfileResolution,
  type ProfileResolutionInput,
  type ProfileResolver,
} from './profile.js';

export interface AuthenticatedProfileResolverOptions {
  authRequired: boolean;
  appCheckEnforce: boolean;
  tokens: TokenVerifier;
  appCheck: AppCheckVerifier;
  authService: AuthService;
  fallback: ProfileResolver;
}

function bearerToken(authorization: string): string | undefined {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match?.[1];
}

export class AuthenticatedProfileResolver implements ProfileResolver {
  constructor(private readonly options: AuthenticatedProfileResolverOptions) {}

  async resolve(input: ProfileResolutionInput): Promise<ProfileResolution> {
    const header = input.authorization;
    if (header === undefined || header.trim().length === 0) {
      if (this.options.authRequired) {
        throw new UnauthorizedError();
      }
      return this.options.fallback.resolve(input);
    }

    if (!/^Bearer\s+\S+/i.test(header)) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
    }
    const token = bearerToken(header);
    if (!token) {
      throw new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
    }

    await this.checkApp(input.appCheckToken);

    const identity = await this.options.tokens.verifyIdToken(token);
    const provisioned = await this.provision(identity);

    return {
      userId: provisioned.user.id,
      mode: 'authenticated',
      firebaseUid: identity.uid,
      role: provisioned.user.role,
      email: provisioned.user.email,
      emailVerified: provisioned.user.emailVerified,
      phoneNumber: provisioned.user.phoneNumber,
      signInProvider: identity.signInProvider,
      authTime: identity.authTime,
      identity,
      userCreated: provisioned.created,
    };
  }

  private async checkApp(appCheckToken: string | undefined): Promise<void> {
    const enforce = this.options.appCheckEnforce;
    const present = appCheckToken !== undefined && appCheckToken.length > 0;
    if (!enforce && !present) return;
    if (!present) {
      throw new AuthAppError(AuthErrorCode.AUTH_APP_CHECK_FAILED);
    }
    try {
      await this.options.appCheck.verify(appCheckToken);
    } catch (error) {
      if (!enforce) return;
      if (error instanceof AuthAppError) throw error;
      throw new AuthAppError(AuthErrorCode.AUTH_APP_CHECK_FAILED);
    }
  }

  private async provision(
    identity: VerifiedIdentity,
  ): Promise<{ user: ApplicationUser; created: boolean }> {
    try {
      return { user: await this.options.authService.me(identity.uid), created: false };
    } catch (error) {
      if (error instanceof AuthAppError && error.code === AuthErrorCode.AUTH_USER_NOT_FOUND) {
        const bootstrapped = await this.options.authService.bootstrap(identity);
        return { user: bootstrapped.user, created: bootstrapped.created };
      }
      throw error;
    }
  }
}
