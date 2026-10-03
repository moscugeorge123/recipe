import { AuthErrorCode } from '@recipe/contracts';

import { AuthAppError } from '../../../shared/errors/app-error.js';
import type {
  AppCheckVerifier,
  IdentityAdmin,
  TokenVerifier,
  VerifiedIdentity,
} from '../domain/token.js';

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
  emulatorHost?: string;
}

interface DecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  auth_time?: number;
  exp: number;
  firebase?: {
    sign_in_provider?: string;
  };
}

interface AuthUserRecord {
  providerData: Array<{ providerId: string }>;
}

interface FirebaseHandles {
  verifyIdToken(token: string): Promise<DecodedToken>;
  getUser(uid: string): Promise<AuthUserRecord>;
  deleteUser(uid: string): Promise<void>;
  verifyAppCheck(token: string): Promise<{ appId: string }>;
}

const APP_NAME = 'recipe-firebase-auth';

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  const info = (error as { errorInfo?: { code?: unknown } }).errorInfo;
  if (info && typeof info.code === 'string') return info.code;
  return undefined;
}

function tokenError(error: unknown): AuthAppError {
  const code = errorCode(error);
  if (code === 'auth/id-token-expired') {
    return new AuthAppError(AuthErrorCode.AUTH_TOKEN_EXPIRED);
  }
  if (
    code === 'auth/id-token-revoked' ||
    code === 'auth/argument-error' ||
    code === 'auth/invalid-id-token'
  ) {
    return new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
  }
  return new AuthAppError(AuthErrorCode.AUTH_TOKEN_INVALID);
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

/**
 * Loads firebase-admin on first use so HMAC unit tests never require credentials.
 * Does not log tokens or private keys.
 */
async function loadHandles(config: FirebaseAdminConfig): Promise<FirebaseHandles> {
  const appModule = await import('firebase-admin/app');
  const authModule = await import('firebase-admin/auth');
  const appCheckModule = await import('firebase-admin/app-check');

  if (config.emulatorHost) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.emulatorHost;
  }

  const existing = appModule.getApps().find((app) => app.name === APP_NAME);
  const app =
    existing ??
    appModule.initializeApp(
      {
        projectId: config.projectId,
        ...(config.clientEmail && config.privateKey
          ? {
              credential: appModule.cert({
                projectId: config.projectId,
                clientEmail: config.clientEmail,
                privateKey: normalizePrivateKey(config.privateKey),
              }),
            }
          : {}),
      },
      APP_NAME,
    );

  const auth = authModule.getAuth(app);
  const appCheck = appCheckModule.getAppCheck(app);

  return {
    verifyIdToken: (token) => auth.verifyIdToken(token, true),
    getUser: (uid) => auth.getUser(uid),
    deleteUser: (uid) => auth.deleteUser(uid),
    verifyAppCheck: async (token) => {
      const result = await appCheck.verifyToken(token);
      return { appId: result.appId };
    },
  };
}

export function createFirebaseAdminAuth(
  config: FirebaseAdminConfig,
): TokenVerifier & AppCheckVerifier & IdentityAdmin {
  let pending: Promise<FirebaseHandles> | undefined;
  const handles = (): Promise<FirebaseHandles> => {
    pending ??= loadHandles(config);
    return pending;
  };

  return {
    async verifyIdToken(token: string): Promise<VerifiedIdentity> {
      let decoded: DecodedToken;
      try {
        const admin = await handles();
        decoded = await admin.verifyIdToken(token);
      } catch (error) {
        throw tokenError(error);
      }

      const signInProvider = decoded.firebase?.sign_in_provider ?? '';
      let providers: string[];
      try {
        const admin = await handles();
        const user = await admin.getUser(decoded.uid);
        // providerData is the source of truth. The identity key `email` is not the password provider.
        providers = user.providerData
          .map((entry) => entry.providerId)
          .filter((providerId) => providerId.length > 0);
      } catch {
        providers = signInProvider ? [signInProvider] : [];
      }

      return {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' && decoded.email.length > 0 ? decoded.email : null,
        emailVerified: decoded.email_verified === true,
        phoneNumber:
          typeof decoded.phone_number === 'string' && decoded.phone_number.length > 0
            ? decoded.phone_number
            : null,
        authTime: typeof decoded.auth_time === 'number' ? decoded.auth_time : 0,
        expiresAt: decoded.exp,
        signInProvider,
        providers,
      };
    },

    async verify(token: string): Promise<{ appId: string }> {
      try {
        const admin = await handles();
        return await admin.verifyAppCheck(token);
      } catch {
        throw new AuthAppError(AuthErrorCode.AUTH_APP_CHECK_FAILED);
      }
    },

    async deleteUser(uid: string): Promise<void> {
      try {
        const admin = await handles();
        await admin.deleteUser(uid);
      } catch (error) {
        if (errorCode(error) === 'auth/user-not-found') return;
        throw error;
      }
    },

    async getProviders(uid: string): Promise<string[] | null> {
      try {
        const admin = await handles();
        const user = await admin.getUser(uid);
        return user.providerData
          .map((entry) => entry.providerId)
          .filter((providerId) => providerId.length > 0);
      } catch (error) {
        if (errorCode(error) === 'auth/user-not-found') return null;
        throw error;
      }
    },
  };
}
