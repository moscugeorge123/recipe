import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';

import { registerErrorHandler } from '../../app/plugins/error-handler.js';
import { registerProfileContext } from '../../app/plugins/profile-context.js';
import { AuthAppError } from '../../shared/errors/app-error.js';
import { ImplicitProfileResolver } from '../profiles/domain/profile.js';
import { AuthenticatedProfileResolver } from '../profiles/domain/authenticated-profile-resolver.js';
import { AbuseGuard } from './application/abuse-guard.js';
import { AuthService } from './application/auth-service.js';
import type { AppCheckVerifier } from './domain/token.js';
import { NoopIdentityAdmin } from './domain/token.js';
import { authRoutes } from './api/auth.routes.js';
import { MemoryAuthRepository } from './infrastructure/auth.repository.js';
import { HmacTokenVerifier, signTestToken } from './infrastructure/hmac-token.js';

const SECRET = 'route-test-hmac-secret';

function token(uid: string, overrides: Record<string, unknown> = {}): string {
  return signTestToken(SECRET, {
    uid,
    email: `${uid}@example.com`,
    email_verified: true,
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: { sign_in_provider: 'password' },
    providers: ['password'],
    ...overrides,
  });
}

async function buildAuthApp(options?: { appCheckEnforce?: boolean }) {
  const repo = new MemoryAuthRepository();
  const tokens = new HmacTokenVerifier(SECRET);
  const appCheck: AppCheckVerifier = {
    async verify(appCheckToken: string): Promise<{ appId: string }> {
      if (appCheckToken === 'valid-app-check') return { appId: 'test-app' };
      throw new AuthAppError('AUTH_APP_CHECK_FAILED');
    },
  };
  const authService = new AuthService(repo, new NoopIdentityAdmin(), new AbuseGuard(), {
    reservedUsernames: [],
    phoneResendSeconds: 60,
    phoneMaxAttempts: 5,
  });
  const resolver = new AuthenticatedProfileResolver({
    authRequired: false,
    appCheckEnforce: options?.appCheckEnforce ?? false,
    tokens,
    appCheck,
    authService,
    fallback: new ImplicitProfileResolver(),
  });
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(
    async (scope) => {
      registerProfileContext(scope, resolver);
      await scope.register(authRoutes, { authService });
    },
    { prefix: '/api/v1' },
  );
  return { app, repo };
}

describe('auth routes', () => {
  it('returns 401 when the token is missing, invalid, or expired', async () => {
    const { app } = await buildAuthApp();

    const missing = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(missing.statusCode).toBe(401);

    const invalid = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer not-a-token' },
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json()).toMatchObject({ error: { code: 'AUTH_TOKEN_INVALID' } });

    const expired = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token('uid-a', { exp: Math.floor(Date.now() / 1000) - 30 })}`,
      },
    });
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toMatchObject({ error: { code: 'AUTH_TOKEN_EXPIRED' } });

    await app.close();
  });

  it('bootstraps the uid from the token and ignores a uid in the body', async () => {
    const { app } = await buildAuthApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers: { authorization: `Bearer ${token('uid-from-token')}` },
      payload: { uid: 'uid-from-body', displayName: 'Ada' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.created).toBe(true);
    expect(response.json().data.user.uid).toBe('uid-from-token');
    expect(response.json().data.user.displayName).toBe('Ada');
    expect(response.json().data.user.uid).not.toBe('uid-from-body');

    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers: { authorization: `Bearer ${token('uid-from-token')}` },
      payload: { uid: 'uid-from-body', displayName: 'Ada' },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().data.created).toBe(false);
    expect(again.json().data.user.id).toBe(response.json().data.user.id);

    await app.close();
  });

  it('checks username availability for the authenticated user', async () => {
    const { app } = await buildAuthApp();
    const headers = { authorization: `Bearer ${token('uid-name')}` };
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers,
      payload: {},
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/username/check',
      headers,
      payload: { username: 'chef_ada' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      available: true,
      username: 'chef_ada',
      usernameNormalized: 'chef_ada',
    });

    await app.close();
  });

  it('rejects a missing or bad App Check token when enforcement is on', async () => {
    const { app } = await buildAuthApp({ appCheckEnforce: true });
    const headers = { authorization: `Bearer ${token('uid-app')}` };

    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers,
      payload: { displayName: 'Ada' },
    });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toMatchObject({ error: { code: 'AUTH_APP_CHECK_FAILED' } });

    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers: { ...headers, 'x-firebase-appcheck': 'nope' },
      payload: { displayName: 'Ada' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toMatchObject({ error: { code: 'AUTH_APP_CHECK_FAILED' } });

    await app.close();
  });

  it('allows a request when App Check is not enforced', async () => {
    const { app } = await buildAuthApp({ appCheckEnforce: false });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers: {
        authorization: `Bearer ${token('uid-monitor')}`,
        'x-firebase-appcheck': 'not-valid',
      },
      payload: { displayName: 'Ada' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.uid).toBe('uid-monitor');

    await app.close();
  });

  it('does not let user A delete or update user B', async () => {
    const { app } = await buildAuthApp();
    const headersA = { authorization: `Bearer ${token('uid-a')}` };
    const headersB = { authorization: `Bearer ${token('uid-b')}` };

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers: headersA,
      payload: { displayName: 'Ada' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/bootstrap',
      headers: headersB,
      payload: { displayName: 'Bea' },
    });

    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: headersA,
      payload: { displayName: 'Ada Updated', userId: 'uid-b' },
    });
    expect(updated.statusCode).toBe(400);

    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: headersA,
      payload: { displayName: 'Ada Updated' },
    });
    expect(patched.statusCode).toBe(200);

    const meB = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: headersB });
    expect(meB.statusCode).toBe(200);
    expect(meB.json().data.displayName).toBe('Bea');
    expect(meB.json().data.uid).toBe('uid-b');

    const deleted = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/account/delete',
      headers: headersA,
      payload: { confirmation: 'DELETE' },
    });
    expect(deleted.statusCode).toBe(200);

    const meBAfter = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: headersB });
    expect(meBAfter.statusCode).toBe(200);
    expect(meBAfter.json().data.uid).toBe('uid-b');
    expect(meBAfter.json().data.displayName).toBe('Bea');

    await app.close();
  });
});
