import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Tests build their own Fastify instance in-process; no network or AWS access required.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/recipe_api_test',
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/recipe_api_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/**/*.types.ts'],
    },
  },
});
