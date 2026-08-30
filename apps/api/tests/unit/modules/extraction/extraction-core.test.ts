import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { MockLLMProvider } from '../../../../src/infrastructure/ai/llm/mock-llm-provider.js';
import { EvidenceBuilder } from '../../../../src/modules/evidence/application/evidence-builder.js';
import { RecipeExtractor } from '../../../../src/modules/recipes/application/recipe-extractor.js';
import { RecipeNormalizer } from '../../../../src/modules/normalization/application/recipe-normalizer.js';
import { ConfidenceCalculator } from '../../../../src/modules/confidence/application/confidence-calculator.js';
import { RecipeValidator } from '../../../../src/modules/validation/application/recipe-validator.js';
import { serializeStageError } from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import { normalizeIngredientName, normalizeUnit } from '../../../../src/modules/normalization/domain/units.js';
import { describeOutputLanguage } from '../../../../src/modules/recipes/prompts/recipe-extraction-v1.js';
import type { LLMInput, LLMProvider, LLMResult } from '../../../../src/infrastructure/ai/llm/llm-provider.js';
describe('EvidenceBuilder', () => {
  const builder = new EvidenceBuilder();
  const instagramFixture = {
    title: 'Creamy Garlic Pasta',
    caption: 'Mix 200g spaghetti with 3 cloves garlic, 2 tbsp olive oil. Serves 2.',
    description: 'Quick weeknight pasta recipe',
    language: 'en',
  };

  it('builds evidence from acquired content', () => {
    const items = builder.build({
      acquiredContent: {
        sourceType: 'INSTAGRAM',
        originalUrl: 'https://instagram.com/reel/1',
        normalizedUrl: 'https://instagram.com/reel/1',
        title: instagramFixture.title,
        caption: instagramFixture.caption,
        description: instagramFixture.description,
        language: instagramFixture.language,
        images: [],
        metadata: {},
      },
    });

    expect(items.some((i) => i.evidenceType === 'CAPTION')).toBe(true);
    expect(items.some((i) => i.evidenceType === 'DESCRIPTION')).toBe(true);
    expect(items.some((i) => i.evidenceType === 'METADATA')).toBe(true);
  });

  it('formats evidence for LLM prompt', () => {
    const items = builder.build({
      acquiredContent: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
        title: 'Test Recipe',
        caption: 'Mix 200g spaghetti. Calories: 450 per serving.',
        images: [],
        metadata: {},
      },
    });

    const prompt = builder.formatForPrompt(items);
    expect(prompt).toContain('Title: Test Recipe');
    expect(prompt).toContain('Post description');
    expect(prompt).toContain('200g spaghetti');
    expect(prompt).toContain('Calories: 450');
  });

  it('does not duplicate identical caption and description', () => {
    const text = '200g flour, 2 eggs. Calories: 320';
    const items = builder.build({
      acquiredContent: {
        sourceType: 'YOUTUBE',
        originalUrl: 'https://youtube.com/watch?v=1',
        normalizedUrl: 'https://youtube.com/watch?v=1',
        caption: text,
        description: text,
        images: [],
        metadata: {},
      },
    });

    const written = items.filter((i) => i.evidenceType === 'CAPTION' || i.evidenceType === 'DESCRIPTION');
    expect(written).toHaveLength(1);
  });
});

describe('RecipeExtractor with MockLLM', () => {
  it('extracts recipe from evidence', async () => {
    const builder = new EvidenceBuilder();
    const evidence = builder.build({
      acquiredContent: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/fake-recipe',
        normalizedUrl: 'https://example.com/fake-recipe',
        title: 'Fake Pasta Recipe',
        caption: 'Mix 200g spaghetti with garlic and olive oil. Serves 2. Calories: 420',
        description: 'A simple weeknight pasta',
        language: 'en',
        images: [],
        metadata: {},
      },
    });

    const extractor = new RecipeExtractor(new MockLLMProvider());
    const { recipe } = await extractor.extract({ evidence, outputLanguage: 'en' });

    expect(recipe.title).toBe('Fake Pasta Recipe');
    expect(recipe.ingredients.length).toBeGreaterThan(0);
    expect(recipe.ingredients[0]?.quantity).toBeTruthy();
    expect(recipe.calories).toBe(420);
    expect(recipe.steps.length).toBeGreaterThan(0);
  });
});

describe('RecipeNormalizer', () => {
  it('normalizes units and ingredient names', () => {
    const normalizer = new RecipeNormalizer();
    const result = normalizer.normalize({
      title: 'Test',
      sourceLanguage: 'ro',
      calories: 380,
      ingredients: [
        { name: 'usturoi', quantity: '3', unit: 'cloves', confidence: 0.8 },
        { name: 'sare', quantity: null, confidence: 0.6 },
      ],
      steps: [{ stepOrder: 1, instruction: 'Mix', confidence: 0.7 }],
    });

    expect(result.ingredients[0]?.canonicalName).toBe('garlic');
    expect(result.ingredients[0]?.name).toBe('Usturoi');
    expect(result.ingredients[0]?.unit).toBe('clove');
    expect(result.calories).toBe(380);
  });

  it('keeps translated names and units when outputLanguage is not English', () => {
    const normalizer = new RecipeNormalizer();
    const result = normalizer.normalize(
      {
        title: 'paste cu usturoi',
        sourceLanguage: 'en',
        ingredients: [
          { name: 'usturoi', quantity: '3', unit: 'căței', confidence: 0.8 },
        ],
        steps: [{ stepOrder: 1, instruction: 'Amestecă usturoiul', confidence: 0.7 }],
      },
      'ro',
    );

    expect(result.title).toBe('Paste cu usturoi');
    expect(result.ingredients[0]?.name).toBe('Usturoi');
    expect(result.ingredients[0]?.canonicalName).toBe('usturoi');
    expect(result.ingredients[0]?.unit).toBe('căței');
  });

  it('sentence-cases the recipe title and ingredient names', () => {
    const normalizer = new RecipeNormalizer();
    const result = normalizer.normalize({
      title: 'tuna melt',
      sourceLanguage: 'en',
      ingredients: [
        { name: 'wholemeal pitta', quantity: '1', confidence: 0.8 },
        { name: 'TUNA', confidence: 0.6 },
      ],
      steps: [{ stepOrder: 1, instruction: 'Mix', confidence: 0.7 }],
    });

    expect(result.title).toBe('Tuna melt');
    expect(result.ingredients[0]?.name).toBe('Wholemeal pitta');
    expect(result.ingredients[1]?.name).toBe('Tuna');
  });
});

describe('ConfidenceCalculator', () => {
  it('scores recipes with quantities higher', () => {
    const calculator = new ConfidenceCalculator();
    const withQty = calculator.calculate({
      title: 'Test Recipe',
      description: 'desc',
      servings: 2,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      sourceLanguage: 'en',
      calories: 450,
      cuisine: null,
      nutrition: null,
      confidence: 0,
      warnings: [],
      ingredients: [
        {
          name: 'flour',
          canonicalName: 'flour',
          quantity: new Prisma.Decimal(1),
          unit: 'cup',
          preparation: null,
          optional: false,
          category: 'Pantry',
          confidence: 0.8,
          provenance: {},
          warnings: [],
          sortOrder: 0,
        },
      ],
      steps: [{ stepOrder: 1, instruction: 'Mix', durationMinutes: null, temperature: null, stage: 'COOK', confidence: 0.8, provenance: {}, warnings: [] }],
    });

    const withoutQty = calculator.calculate({
      title: 'Test',
      description: null,
      servings: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      sourceLanguage: 'en',
      calories: null,
      cuisine: null,
      nutrition: null,
      confidence: 0,
      warnings: [{ code: 'MISSING_QUANTITY', message: 'missing' }],
      ingredients: [
        {
          name: 'flour',
          canonicalName: 'flour',
          quantity: null,
          unit: null,
          preparation: null,
          optional: false,
          category: 'Pantry',
          confidence: 0.5,
          provenance: {},
          warnings: ['Missing quantity'],
          sortOrder: 0,
        },
      ],
      steps: [{ stepOrder: 1, instruction: 'Mix', durationMinutes: null, temperature: null, stage: 'COOK', confidence: 0.5, provenance: {}, warnings: [] }],
    });

    expect(withQty).toBeGreaterThan(withoutQty);
  });
});

describe('RecipeValidator', () => {
  it('warns on missing ingredients', () => {
    const validator = new RecipeValidator();
    const result = validator.validate({
      title: 'Empty',
      description: null,
      servings: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      sourceLanguage: 'en',
      calories: null,
      cuisine: null,
      nutrition: null,
      confidence: 0,
      warnings: [],
      ingredients: [],
      steps: [],
    });

    expect(result.valid).toBe(false);
    expect(result.warnings.some((w) => w.code === 'NO_INGREDIENTS')).toBe(true);
  });
});

describe('unit normalization', () => {
  it('normalizes Romanian units', () => {
    expect(normalizeUnit('linguri')).toBe('tbsp');
    expect(normalizeIngredientName('usturoi')).toBe('garlic');
  });
});

describe('output language', () => {
  it('describes common outputLanguage codes', () => {
    expect(describeOutputLanguage('en')).toBe('English (en)');
    expect(describeOutputLanguage('ro')).toBe('Romanian (ro)');
    expect(describeOutputLanguage('pt-BR')).toBe('Portuguese (pt-BR)');
  });

  it('asks the model to write the recipe in outputLanguage', async () => {
    let captured = '';
    const llm: LLMProvider = {
      generateStructured: async <T>(input: LLMInput): Promise<LLMResult<T>> => {
        captured = input.messages.map((m) => m.content).join('\n');
        return {
          data: {
            title: 'Paste',
            description: null,
            sourceLanguage: 'en',
            ingredients: [],
            steps: [],
          } as T,
          model: 'test',
          usage: { inputTokens: 1, outputTokens: 1 },
          durationMs: 1,
        };
      },
    };

    await new RecipeExtractor(llm).extract({
      evidence: [],
      outputLanguage: 'ro',
    });

    expect(captured).toContain('Romanian (ro)');
    expect(captured).toContain('Write the entire recipe in Romanian (ro)');
    expect(captured).toContain('quantity phrases, units, preparation, temperature');
    expect(captured).toContain('Do not paste the original post caption into description');
    expect(captured).not.toContain('proteinGrams');
  });

  it('asks the model for per-serving macros when extractNutrition is true', async () => {
    let captured = '';
    const llm: LLMProvider = {
      generateStructured: async <T>(input: LLMInput): Promise<LLMResult<T>> => {
        captured = input.messages.map((m) => m.content).join('\n');
        return {
          data: {
            title: 'Pasta',
            description: null,
            sourceLanguage: 'en',
            ingredients: [],
            steps: [],
          } as T,
          model: 'test',
          usage: { inputTokens: 1, outputTokens: 1 },
          durationMs: 1,
        };
      },
    };

    await new RecipeExtractor(llm).extract({
      evidence: [],
      outputLanguage: 'en',
      extractNutrition: true,
    });

    expect(captured).toContain('proteinGrams');
    expect(captured).toContain('carbsGrams');
    expect(captured).toContain('fatGrams');
    expect(captured).toContain('per serving');
    expect(captured).toContain('otherwise null');
  });
});

describe('serializeStageError', () => {
  it('keeps a plain message when there is no cause', () => {
    expect(serializeStageError(new Error('Stage failed'))).toEqual({ message: 'Stage failed' });
  });

  it('includes nested cause messages and stderr', () => {
    const spawned = Object.assign(new Error('spawn yt-dlp ENOENT'), {
      code: 'ENOENT',
      stderr: 'yt-dlp: command not found\n',
    });
    const wrapped = new Error('Failed to fetch YouTube metadata: yt-dlp is not installed or not on PATH', {
      cause: spawned,
    });

    expect(serializeStageError(wrapped)).toEqual({
      message: 'Failed to fetch YouTube metadata: yt-dlp is not installed or not on PATH',
      cause: 'spawn yt-dlp ENOENT | yt-dlp: command not found',
    });
  });
});
