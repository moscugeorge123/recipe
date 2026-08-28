import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

import { PrismaExtractionJobRepository } from '../../../src/infrastructure/database/repositories/extraction-job.repository.js';
import { PrismaRecipeRepository } from '../../../src/infrastructure/database/repositories/recipe.repository.js';
import { PrismaRecipeSourceRepository } from '../../../src/infrastructure/database/repositories/recipe-source.repository.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('database repositories', () => {
  const prisma = getTestPrisma();
  const recipeSourceRepo = new PrismaRecipeSourceRepository(prisma);
  const extractionJobRepo = new PrismaExtractionJobRepository(prisma);
  const recipeRepo = new PrismaRecipeRepository(prisma);

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('PrismaRecipeSourceRepository', () => {
    it('creates and finds a source by url hash', async () => {
      const created = await recipeSourceRepo.create({
        sourceType: 'INSTAGRAM',
        originalUrl: 'https://www.instagram.com/reel/abc123/',
        normalizedUrl: 'https://www.instagram.com/reel/abc123',
        urlHash: 'hash-abc123',
        metadata: { author: 'chef' },
      });

      const found = await recipeSourceRepo.findByUrlHash('hash-abc123');

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.sourceType).toBe('INSTAGRAM');
    });
  });

  describe('PrismaExtractionJobRepository', () => {
    it('creates, updates and finds jobs', async () => {
      const source = await recipeSourceRepo.create({
        sourceType: 'YOUTUBE',
        originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        urlHash: 'hash-youtube-1',
      });

      const job = await extractionJobRepo.create({
        recipeSourceId: source.id,
        outputLanguage: 'en',
        options: { highAccuracy: false },
      });

      expect(job.status).toBe('QUEUED');
      expect(job.progress).toBe(0);

      const updated = await extractionJobRepo.update(job.id, {
        status: 'ACQUIRING_CONTENT',
        progress: 10,
        currentStage: 'acquiring_content',
        startedAt: new Date(),
      });

      expect(updated.status).toBe('ACQUIRING_CONTENT');
      expect(updated.progress).toBe(10);

      const found = await extractionJobRepo.findById(job.id);
      expect(found?.currentStage).toBe('acquiring_content');
    });

    it('finds the latest completed job for a source', async () => {
      const source = await recipeSourceRepo.create({
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/recipe',
        normalizedUrl: 'https://example.com/recipe',
        urlHash: 'hash-generic-1',
      });

      const recipe = await recipeRepo.create({
        recipeSourceId: source.id,
        title: 'Test Recipe',
        ingredients: [{ name: 'flour', sortOrder: 0 }],
        steps: [{ stepOrder: 1, instruction: 'Mix' }],
      });

      const job = await extractionJobRepo.create({
        recipeSourceId: source.id,
        outputLanguage: 'en',
      });

      await extractionJobRepo.update(job.id, {
        status: 'COMPLETED',
        recipeId: recipe.id,
        completedAt: new Date(),
      });

      const latest = await extractionJobRepo.findLatestCompletedBySourceId(source.id);

      expect(latest?.id).toBe(job.id);
      expect(latest?.recipeId).toBe(recipe.id);
    });
  });

  describe('PrismaRecipeRepository', () => {
    it('creates a recipe with nested ingredients and steps', async () => {
      const source = await recipeSourceRepo.create({
        sourceType: 'INSTAGRAM',
        originalUrl: 'https://www.instagram.com/reel/xyz/',
        normalizedUrl: 'https://www.instagram.com/reel/xyz',
        urlHash: 'hash-recipe-create',
      });

      const recipe = await recipeRepo.create({
        recipeSourceId: source.id,
        title: 'Pasta Aglio e Olio',
        description: 'Simple garlic pasta',
        servings: 2,
        confidence: 0.92,
        ingredients: [
          {
            name: 'spaghetti',
            canonicalName: 'spaghetti',
            quantity: new Prisma.Decimal('200'),
            unit: 'g',
            sortOrder: 0,
            confidence: 0.95,
          },
          {
            name: 'garlic',
            canonicalName: 'garlic',
            sortOrder: 1,
            optional: false,
          },
        ],
        steps: [
          { stepOrder: 1, instruction: 'Boil pasta until al dente', durationMinutes: 10 },
          { stepOrder: 2, instruction: 'Sauté garlic in olive oil' },
        ],
      });

      expect(recipe.ingredients).toHaveLength(2);
      expect(recipe.steps).toHaveLength(2);
      expect(recipe.ingredients[0]?.name).toBe('spaghetti');

      const loaded = await recipeRepo.findById(recipe.id);
      expect(loaded?.title).toBe('Pasta Aglio e Olio');

      const bySource = await recipeRepo.findBySourceId(source.id);
      expect(bySource?.id).toBe(recipe.id);
    });

    it('lists recipes with pagination', async () => {
      for (let i = 0; i < 3; i++) {
        const index = String(i);
        const source = await recipeSourceRepo.create({
          sourceType: 'GENERIC_WEB',
          originalUrl: `https://example.com/r${index}`,
          normalizedUrl: `https://example.com/r${index}`,
          urlHash: `hash-list-${index}`,
        });

        await recipeRepo.create({
          recipeSourceId: source.id,
          title: `Recipe ${index}`,
          ingredients: [],
          steps: [],
        });
      }

      const page1 = await recipeRepo.list({ page: 1, pageSize: 2 });
      expect(page1.total).toBe(3);
      expect(page1.items).toHaveLength(2);

      const page2 = await recipeRepo.list({ page: 2, pageSize: 2 });
      expect(page2.items).toHaveLength(1);
    });

    it('deletes a recipe', async () => {
      const source = await recipeSourceRepo.create({
        sourceType: 'YOUTUBE',
        originalUrl: 'https://youtube.com/watch?v=delete',
        normalizedUrl: 'https://youtube.com/watch?v=delete',
        urlHash: 'hash-delete',
      });

      const recipe = await recipeRepo.create({
        recipeSourceId: source.id,
        title: 'To Delete',
        ingredients: [],
        steps: [],
      });

      await recipeRepo.delete(recipe.id);

      const found = await recipeRepo.findById(recipe.id);
      expect(found).toBeNull();
    });
  });
});
