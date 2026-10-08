import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type { ProfileResolver } from '../../modules/profiles/domain/profile.js';
import { registerProfileContext } from './profile-context.js';

describe('profile request context', () => {
  it('exposes the resolver result without requiring authentication', async () => {
    const resolve = vi.fn<ProfileResolver['resolve']>().mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000001',
      mode: 'implicit',
    });
    const app = Fastify();
    app.get('/health', () => ({ status: 'ok' }));
    await app.register(
      async (resources) => {
        registerProfileContext(resources, { resolve });
        resources.get('/profile', (request) => request.profile);
      },
      { prefix: '/api/v1' },
    );

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(resolve).not.toHaveBeenCalled();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profile',
      headers: { authorization: 'Bearer future-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: '00000000-0000-4000-8000-000000000001',
      mode: 'implicit',
    });
    expect(resolve).toHaveBeenCalledWith({
      requestId: expect.any(String),
      authorization: 'Bearer future-token',
    });

    await app.close();
  });
});
