import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../helpers/build-test-app.js';

describe('POST /api/v1/recipes/preview', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns unfurled fake-recipe metadata with multiple thumbnails', async () => {
    app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/preview',
      payload: { url: 'https://example.com/fake-recipe' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      url: 'https://example.com/fake-recipe',
      sourceType: 'GENERIC_WEB',
      title: 'Fake Pasta Recipe',
      author: 'fixture-chef',
      description: 'A simple weeknight pasta from the fake provider fixture.',
    });
    expect(response.json().data.thumbnails.length).toBeGreaterThan(1);
  });

  it('rejects a private URL with INVALID_URL', async () => {
    app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/preview',
      payload: { url: 'http://127.0.0.1/' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_URL');
  });
});
