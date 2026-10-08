import { describe, expect, it, vi } from 'vitest';

import type {
  LLMInput,
  LLMProvider,
  LLMResult,
} from '../../../../src/infrastructure/ai/llm/llm-provider.js';
import type { AcquiredContent } from '../../../../src/modules/content/domain/types.js';
import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
import { EvidenceBuilder } from '../../../../src/modules/evidence/application/evidence-builder.js';
import {
  assertExtractedRecipeHasContent,
  assertFoodRecipe,
  classifyFromSignals,
  createRecipeClassifier,
  HeuristicRecipeClassifier,
  LLMRecipeClassifier,
  type RecipeClassifierInput,
} from '../../../../src/modules/recipes/application/recipe-classifier.js';
import { computeRecipeSignals } from '../../../../src/modules/recipes/application/recipe-signals.js';
import {
  RECIPE_CLASSIFICATION_PROMPT_VERSION,
  RECIPE_CLASSIFICATION_SCHEMA,
} from '../../../../src/modules/recipes/prompts/recipe-classification-v1.js';
import { serializeStageError } from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import { NotARecipeError } from '../../../../src/shared/errors/extraction-errors.js';
import { htmlFetch, webFixture } from '../../../helpers/web-fixtures.js';

const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };
const builder = new EvidenceBuilder();

async function inputFromFixture(name: string, url = `https://site.example/${name}`) {
  const content = await new GenericWebContentProvider({
    fetchImpl: htmlFetch(webFixture(name)),
  }).acquire(url, ctx);
  return inputFromContent(content);
}

function inputFromContent(content: AcquiredContent): RecipeClassifierInput {
  return {
    evidence: builder.build({ acquiredContent: content }),
    ...(content.structuredRecipe ? { structuredRecipe: content.structuredRecipe } : {}),
    sourceType: content.sourceType,
    url: content.originalUrl,
  };
}

function socialPost(caption: string, sourceType: AcquiredContent['sourceType'] = 'INSTAGRAM') {
  return inputFromContent({
    sourceType,
    originalUrl: 'https://www.instagram.com/reel/x/',
    normalizedUrl: 'https://www.instagram.com/reel/x/',
    caption,
    images: [],
    metadata: {},
  });
}

function stubLlm(respond: (input: LLMInput) => unknown): LLMProvider & { calls: LLMInput[] } {
  const calls: LLMInput[] = [];
  return {
    calls,
    generateStructured: <T>(input: LLMInput): Promise<LLMResult<T>> => {
      calls.push(input);
      return Promise.resolve().then(() => ({
        data: respond(input) as T,
        model: 'stub',
        usage: { inputTokens: 1, outputTokens: 1 },
        durationMs: 1,
      }));
    },
  };
}

const heuristic = new HeuristicRecipeClassifier();

/**
 * Heuristic (no-OpenAI) outcomes per link type. Decision on drinks: cocktails, smoothies and
 * similar are recipes (edible, have ingredients + preparation) and are accepted.
 */
describe('HeuristicRecipeClassifier on web fixtures', () => {
  it.each([
    ['recipe-blog-jsonld.html', true, 'food_recipe', 'structured-data'],
    ['recipe-blog-graph.html', true, 'food_recipe', 'structured-data'],
    ['recipe-microdata.html', true, 'food_recipe', 'structured-data'],
    ['recipe-text-only.html', true, 'food_recipe', 'heuristic'],
    ['cocktail.html', true, 'drink_recipe', 'heuristic'],
    ['news-article.html', false, 'not_food', 'heuristic'],
    ['recipe-for-success.html', false, 'not_food', 'heuristic'],
    ['product-page.html', false, 'product_page', 'heuristic'],
    ['diy-soap.html', false, 'not_food', 'heuristic'],
  ])('%s → isFoodRecipe=%s (%s via %s)', async (fixture, isFoodRecipe, category, method) => {
    const result = await heuristic.classify(await inputFromFixture(fixture));
    expect(result).toMatchObject({ isFoodRecipe, category, method });
    if (isFoodRecipe) {
      expect(() => {
        assertFoodRecipe(result);
      }).not.toThrow();
    } else {
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(() => {
        assertFoodRecipe(result);
      }).toThrow(NotARecipeError);
    }
  });

  it('gives thin social captions the benefit of the doubt', async () => {
    const result = await heuristic.classify(socialPost('Best tacos ever 🌮 #foodie'));
    expect(result.isFoodRecipe).toBe(true);
    expect(result.category).toBe('unclear');
    expect(() => {
      assertFoodRecipe(result);
    }).not.toThrow();
  });

  it('accepts an Instagram caption with a recipe in it', async () => {
    const result = await heuristic.classify(
      socialPost(
        'Creamy garlic pasta 🍝 200g spaghetti, 3 cloves garlic, 2 tbsp olive oil. Boil pasta, toss with garlic oil and serve with parmesan.',
      ),
    );
    expect(result).toMatchObject({ isFoodRecipe: true, category: 'food_recipe' });
  });

  it('accepts lye pretzels despite a non-edible term', () => {
    const s = computeRecipeSignals(
      'Pretzels: 500 g flour, 7 g yeast, 300 ml water, 1 tsp salt. Knead, shape, dip in food-grade lye and bake at 220C until golden.',
    );
    expect(classifyFromSignals(s).isFoodRecipe).toBe(true);
  });
});

describe('recipe signals', () => {
  it('matches whole words only', () => {
    const s = computeRecipeSignals('Bring water to a boil. Add a teaspoon of honey.');
    expect(s.foodTermCount).toBe(1); // honey, not "oil" in boil or "tea" in teaspoon
  });

  it('flags figurative recipes', () => {
    expect(
      computeRecipeSignals('A recipe for disaster in the markets').figurativeRecipePhrase,
    ).toBe(true);
    expect(computeRecipeSignals('The recipe for a great team').figurativeRecipePhrase).toBe(true);
    expect(computeRecipeSignals('A recipe for pancakes').figurativeRecipePhrase).toBe(false);
  });
});

describe('LLMRecipeClassifier', () => {
  it('skips the LLM when the page has schema.org Recipe data', async () => {
    const llm = stubLlm(() => {
      throw new Error('must not be called');
    });
    const result = await new LLMRecipeClassifier(llm).classify(
      await inputFromFixture('recipe-blog-jsonld.html'),
    );
    expect(llm.calls).toHaveLength(0);
    expect(result).toMatchObject({ isFoodRecipe: true, method: 'structured-data' });
  });

  it('sends evidence, signals and the strict schema to the LLM', async () => {
    const llm = stubLlm(() => ({
      isFoodRecipe: false,
      confidence: 0.93,
      category: 'not_food',
      reason: 'A business article using "recipe" figuratively.',
    }));
    const input = await inputFromFixture('recipe-for-success.html');
    const result = await new LLMRecipeClassifier(llm).classify(input);

    expect(llm.calls).toHaveLength(1);
    const user = llm.calls[0]?.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).toContain('Source type: GENERIC_WEB');
    expect(user).toContain('Heuristic signals: schema.org Recipe: no');
    expect(user).toContain('Title: The Recipe for Success');
    expect(user).toContain('Page text');
    expect(result).toMatchObject({
      isFoodRecipe: false,
      method: 'llm',
      category: 'not_food',
      promptVersion: RECIPE_CLASSIFICATION_PROMPT_VERSION,
    });
    expect(() => {
      assertFoodRecipe(result);
    }).toThrow(/figuratively/);
    expect(RECIPE_CLASSIFICATION_SCHEMA.required).toEqual([
      'isFoodRecipe',
      'confidence',
      'category',
      'reason',
    ]);
  });

  it('does not reject when the LLM is unsure', async () => {
    const llm = stubLlm(() => ({
      isFoodRecipe: false,
      confidence: 0.55,
      category: 'unclear',
      reason: 'Only a short caption.',
    }));
    const result = await new LLMRecipeClassifier(llm).classify(socialPost('Dinner tonight ✨'));
    expect(result.method).toBe('llm');
    expect(() => {
      assertFoodRecipe(result);
    }).not.toThrow();
  });

  it('clamps confidence and normalizes unknown categories', async () => {
    const llm = stubLlm(() => ({
      isFoodRecipe: true,
      confidence: 7,
      category: 'dessert',
      reason: 'Cake.',
    }));
    const result = await new LLMRecipeClassifier(llm).classify(socialPost('cake'));
    expect(result.confidence).toBe(1);
    expect(result.category).toBe('unclear');
  });

  it('falls back to the heuristic when the LLM fails or returns garbage', async () => {
    const warn = vi.fn();
    const log = { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => log };
    const failing = stubLlm(() => {
      throw new Error('rate limited');
    });
    const news = await inputFromFixture('news-article.html');

    const failed = await new LLMRecipeClassifier(failing, log as never).classify(news);
    expect(failed).toMatchObject({ isFoodRecipe: false, method: 'llm-fallback-heuristic' });
    expect(warn).toHaveBeenCalledOnce();

    const garbage = stubLlm(() => ({ answer: 'yes' }));
    const fromGarbage = await new LLMRecipeClassifier(garbage).classify(news);
    expect(fromGarbage.method).toBe('llm-fallback-heuristic');
  });

  it('createRecipeClassifier picks the heuristic when OpenAI is not configured', () => {
    const llm = stubLlm(() => ({}));
    expect(createRecipeClassifier(llm, { useLlm: false })).toBeInstanceOf(
      HeuristicRecipeClassifier,
    );
    expect(createRecipeClassifier(llm, { useLlm: true })).toBeInstanceOf(LLMRecipeClassifier);
  });
});

describe('not-a-recipe guards', () => {
  it('rejects an extraction with no ingredients and no steps', () => {
    expect(() => {
      assertExtractedRecipeHasContent({ ingredients: [], steps: [] });
    }).toThrow(NotARecipeError);
    expect(() => {
      assertExtractedRecipeHasContent({ ingredients: [{}], steps: [] });
    }).not.toThrow();
    expect(() => {
      assertExtractedRecipeHasContent({ ingredients: [], steps: [{}] });
    }).not.toThrow();
  });

  it('serializes the NOT_A_RECIPE code onto the job error', () => {
    const error = new NotARecipeError({ message: 'The link does not look like a food recipe' });
    expect(serializeStageError(error)).toEqual({
      message: 'The link does not look like a food recipe',
      code: 'NOT_A_RECIPE',
    });
    expect(error.statusCode).toBe(422);
  });
});
