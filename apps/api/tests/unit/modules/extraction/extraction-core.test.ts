import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { MockLLMProvider } from '../../../../src/infrastructure/ai/llm/mock-llm-provider.js';
import { EvidenceBuilder } from '../../../../src/modules/evidence/application/evidence-builder.js';
import { RecipeExtractor } from '../../../../src/modules/recipes/application/recipe-extractor.js';
import { RecipeNormalizer } from '../../../../src/modules/normalization/application/recipe-normalizer.js';
import { ConfidenceCalculator } from '../../../../src/modules/confidence/application/confidence-calculator.js';
import { RecipeValidator } from '../../../../src/modules/validation/application/recipe-validator.js';
import { serializeStageError } from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import {
  normalizeIngredientName,
  normalizeUnit,
  parseQuantity,
} from '../../../../src/modules/normalization/domain/units.js';
import {
  RECIPE_EXTRACTION_PROMPT_VERSION,
  RECIPE_EXTRACTION_SCHEMA,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  describeOutputLanguage,
} from '../../../../src/modules/recipes/prompts/recipe-extraction-v1.js';
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
    expect(recipe.nutritionSource).toBe('stated');
    expect(recipe.nutrition).toEqual({
      proteinGrams: expect.any(Number),
      carbsGrams: expect.any(Number),
      fatGrams: expect.any(Number),
    });
    expect(recipe.steps.length).toBeGreaterThan(0);
  });

  it('returns an estimated calorie figure when the evidence states none', async () => {
    const evidence = new EvidenceBuilder().build({
      acquiredContent: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/fake-recipe',
        normalizedUrl: 'https://example.com/fake-recipe',
        title: 'Fake Pasta Recipe',
        caption: 'Mix 200g spaghetti with garlic and olive oil. Serves 2.',
        images: [],
        metadata: {},
      },
    });

    const { recipe } = await new RecipeExtractor(new MockLLMProvider()).extract({
      evidence,
      outputLanguage: 'en',
    });

    expect(recipe.calories).toBeGreaterThan(0);
    expect(recipe.nutritionSource).toBe('estimated');
    expect(['Easy', 'Medium', 'Hard']).toContain(recipe.difficulty);
  });
});

describe('parseQuantity', () => {
  it.each([
    ['2', 2],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['1½', 1.5],
    ['½', 0.5],
    ['2-3', 2],
    ['0,5', 0.5],
    ['200g', 200],
    ['about 3', 3],
  ])('%s → %d', (raw, expected) => {
    expect(parseQuantity(raw)).toBe(expected);
  });

  it('returns null for text without a number', () => {
    expect(parseQuantity('a pinch')).toBeNull();
    expect(parseQuantity('1/0')).toBeNull();
    expect(parseQuantity(null)).toBeNull();
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
      steps: [{ stepOrder: 1, title: null, instruction: 'Mix', durationMinutes: null, temperature: null, stage: 'COOK', ahead: false, confidence: 0.8, provenance: {}, warnings: [] }],
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
      steps: [{ stepOrder: 1, title: null, instruction: 'Mix', durationMinutes: null, temperature: null, stage: 'COOK', ahead: false, confidence: 0.5, provenance: {}, warnings: [] }],
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
  });

  it('always asks for per-serving calories and macros, stated or estimated', async () => {
    let captured = '';
    let schema: Record<string, unknown> = {};
    const llm: LLMProvider = {
      generateStructured: async <T>(
        input: LLMInput,
        requested: Record<string, unknown>,
      ): Promise<LLMResult<T>> => {
        captured = input.messages.map((m) => m.content).join('\n');
        schema = requested;
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

    await new RecipeExtractor(llm).extract({ evidence: [], outputLanguage: 'en' });

    expect(captured).toContain('proteinGrams');
    expect(captured).toContain('per serving');
    expect(captured).toContain('nutritionSource "estimated"');
    expect(captured).toContain('Never return null for calories or macros');
    expect(captured).toContain('180°C (350°F)');
    expect(schema.required).toEqual(
      expect.arrayContaining(['calories', 'nutrition', 'nutritionSource', 'difficulty']),
    );
  });
});

describe('RECIPE_EXTRACTION_SCHEMA', () => {
  const properties = RECIPE_EXTRACTION_SCHEMA.properties;
  const ingredient = properties.ingredients.items;
  const step = properties.steps.items;

  it('is strict-mode compatible: every property is required and no extras are allowed', () => {
    const check = (node: {
      properties: Record<string, unknown>;
      required: readonly string[];
      additionalProperties: boolean;
    }): void => {
      expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
      expect(node.additionalProperties).toBe(false);
    };
    check(RECIPE_EXTRACTION_SCHEMA);
    check(ingredient);
    check(step);
    check(properties.nutrition);
    check(ingredient.properties.metric);
    check(ingredient.properties.imperial);
  });

  it('makes calories, macros, difficulty and nutritionSource non-nullable', () => {
    expect(properties.calories.type).toBe('integer');
    expect(properties.nutrition.type).toBe('object');
    expect(properties.nutrition.properties.proteinGrams.type).toBe('integer');
    expect(properties.nutritionSource.enum).toEqual(['stated', 'estimated']);
    expect(properties.difficulty.enum).toEqual(['Easy', 'Medium', 'Hard']);
  });

  it('asks for step temperatures in both scales and ingredient indexes', () => {
    expect(step.properties.temperatureCelsius.type).toEqual(['integer', 'null']);
    expect(step.properties.temperatureFahrenheit.type).toEqual(['integer', 'null']);
    expect(step.properties.ingredientIndexes.items.type).toBe('integer');
  });

  it('asks for a short title, a wait-only timer, and pre-steps', () => {
    expect(step.properties.title.type).toBe('string');
    expect(step.properties.ahead.type).toBe('boolean');
    expect(step.properties.durationMinutes.type).toEqual(['integer', 'null']);
    expect(RECIPE_EXTRACTION_SYSTEM_PROMPT).toContain('durationMinutes is the cook timer');
    expect(RECIPE_EXTRACTION_SYSTEM_PROMPT).toContain('ahead is true only for a pre-step');
    expect(RECIPE_EXTRACTION_SYSTEM_PROMPT).toContain('soak rice in water for 4 hours');
  });

  it('uses the bumped prompt version', () => {
    expect(RECIPE_EXTRACTION_PROMPT_VERSION).toBe('recipe-extraction-v10');
  });
});

describe('RecipeNormalizer nutrition, units and steps', () => {
  const normalizer = new RecipeNormalizer();

  it('keeps stated nutrition and marks it stated', () => {
    const result = normalizer.normalize({
      title: 'Soup',
      sourceLanguage: 'en',
      calories: 320.4,
      nutritionSource: 'stated',
      nutrition: { proteinGrams: 12.6, carbsGrams: 40, fatGrams: 9 },
      ingredients: [],
      steps: [],
    });
    expect(result.calories).toBe(320);
    expect(result.nutrition).toEqual({ proteinGrams: 13, carbsGrams: 40, fatGrams: 9 });
    expect(result.nutritionSource).toBe('stated');
  });

  it('defaults the source to estimated and drops implausible values', () => {
    const result = normalizer.normalize({
      title: 'Soup',
      sourceLanguage: 'en',
      calories: 99999,
      nutritionSource: 'guess',
      nutrition: { proteinGrams: -3, carbsGrams: 50, fatGrams: null },
      ingredients: [],
      steps: [],
    });
    expect(result.calories).toBeNull();
    expect(result.nutrition).toEqual({ proteinGrams: null, carbsGrams: 50, fatGrams: null });
    expect(result.nutritionSource).toBe('estimated');
  });

  it('has no nutrition source when nothing is known', () => {
    const result = normalizer.normalize({
      title: 'Soup',
      sourceLanguage: 'en',
      ingredients: [],
      steps: [],
    });
    expect(result.calories).toBeNull();
    expect(result.nutrition).toBeNull();
    expect(result.nutritionSource).toBeNull();
  });

  it('normalizes difficulty and servings', () => {
    const result = normalizer.normalize({
      title: 'Soup',
      sourceLanguage: 'en',
      difficulty: 'medium',
      servings: 0,
      ingredients: [],
      steps: [],
    });
    expect(result.difficulty).toBe('Medium');
    expect(result.servings).toBeNull();
    expect(
      normalizer.normalize({ title: 'x', sourceLanguage: 'en', difficulty: 'Weekend', ingredients: [], steps: [] })
        .difficulty,
    ).toBeNull();
  });

  it('fills metric and imperial amounts for every ingredient', () => {
    const result = normalizer.normalize({
      title: 'Cake',
      sourceLanguage: 'en',
      ingredients: [
        {
          name: 'flour',
          quantity: '1 1/2',
          unit: 'cups',
          metric: { quantity: 180, unit: 'g' },
          imperial: { quantity: 1.5, unit: 'cup' },
          confidence: 0.9,
        },
        { name: 'butter', quantity: '113', unit: 'g', confidence: 0.9 },
        { name: 'garlic', quantity: '2', unit: 'cloves', confidence: 0.9 },
        { name: 'salt', quantity: null, unit: null, optional: true, confidence: 0.9 },
      ],
      steps: [],
    });
    const [flour, butter, garlic, salt] = result.ingredients;
    expect(flour).toMatchObject({ unit: 'cup', metricUnit: 'g', imperialUnit: 'cup' });
    expect(flour?.quantity?.toNumber()).toBe(1.5);
    expect(flour?.metricQuantity?.toNumber()).toBe(180);
    expect(butter?.metricQuantity?.toNumber()).toBe(113);
    expect(butter).toMatchObject({ metricUnit: 'g', imperialUnit: 'oz' });
    expect(butter?.imperialQuantity?.toNumber()).toBe(4);
    expect(garlic).toMatchObject({ metricUnit: 'clove', imperialUnit: 'clove' });
    expect(garlic?.metricQuantity?.toNumber()).toBe(2);
    expect(salt).toMatchObject({
      metricQuantity: null,
      metricUnit: null,
      imperialQuantity: null,
      imperialUnit: null,
    });
  });

  it('adds °C/°F, dual inline measurements and valid ingredient refs to steps', () => {
    const result = normalizer.normalize({
      title: 'Cake',
      sourceLanguage: 'en',
      ingredients: [
        { name: 'flour', quantity: '200', unit: 'g', confidence: 0.9 },
        { name: 'butter', quantity: '100', unit: 'g', confidence: 0.9 },
      ],
      steps: [
        {
          stepOrder: 1,
          instruction: 'Bake at 180°C until golden, then cut into 2 cm squares.',
          temperature: '180°C',
          temperatureCelsius: 180,
          temperatureFahrenheit: 180,
          ingredientIndexes: [1, 0, 1, 7, -1],
          confidence: 0.9,
        },
      ],
    });
    expect(result.steps[0]).toMatchObject({
      instruction: 'Bake at 180°C (350°F) until golden, then cut into 2 cm (¾ in) squares.',
      temperatureCelsius: 180,
      temperatureFahrenheit: 350,
      ingredientRefs: [0, 1],
      title: null,
      ahead: false,
      durationMinutes: null,
    });
  });

  it('keeps a short title, a wait timer, and moves pre-steps first', () => {
    const result = normalizer.normalize({
      title: 'Rice bowl',
      sourceLanguage: 'en',
      ingredients: [],
      steps: [
        {
          stepOrder: 1,
          title: 'Chop the onion',
          instruction: 'Chop the onion. Dice it fine.',
          durationMinutes: null,
          ahead: false,
          confidence: 0.9,
        },
        {
          stepOrder: 2,
          title: 'SOAK THE RICE.',
          instruction: 'Soak the rice. Cover with cold water for 4 hours.',
          durationMinutes: 240,
          ahead: true,
          stage: 'PREP',
          confidence: 0.9,
        },
      ],
    });
    expect(result.steps.map((step) => step.title)).toEqual(['Soak the rice', 'Chop the onion']);
    expect(result.steps[0]).toMatchObject({
      instruction: 'Cover with cold water for 4 hours.',
      durationMinutes: 240,
      ahead: true,
      stepOrder: 1,
    });
    expect(result.steps[1]).toMatchObject({
      instruction: 'Dice it fine.',
      durationMinutes: null,
      ahead: false,
      stepOrder: 2,
    });
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
