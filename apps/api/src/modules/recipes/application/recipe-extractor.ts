import type { LLMProvider } from '../../../infrastructure/ai/llm/llm-provider.js';
import type { EvidenceItem } from '../../evidence/domain/types.js';
import { EvidenceBuilder } from '../../evidence/application/evidence-builder.js';
import type { ExtractedRecipe } from '../domain/types.js';
import {
  RECIPE_EXTRACTION_PROMPT_VERSION,
  RECIPE_EXTRACTION_SCHEMA,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  describeOutputLanguage,
} from '../prompts/recipe-extraction-v1.js';

export interface RecipeExtractorInput {
  evidence: EvidenceItem[];
  outputLanguage: string;
  extractNutrition?: boolean;
}

export class RecipeExtractor {
  private readonly evidenceBuilder = new EvidenceBuilder();

  constructor(private readonly llm: LLMProvider) {}

  async extract(input: RecipeExtractorInput): Promise<{
    recipe: ExtractedRecipe;
    promptVersion: string;
    rawExtraction: ExtractedRecipe;
  }> {
    const evidenceText = this.evidenceBuilder.formatForPrompt(input.evidence);

    const language = describeOutputLanguage(input.outputLanguage);
    const nutritionInstruction = input.extractNutrition
      ? '\n\nExtract proteinGrams, carbsGrams, and fatGrams per serving when the evidence states them; otherwise null.'
      : '';
    const userPrompt = `Output language: ${language}

Write the entire recipe in ${language}. Translate all of the following into ${language}: title, description, ingredient names, quantity phrases, units, preparation, temperature, and step instructions. Keep numeric amounts as digits. Do not leave any of those fields in the source language. Set sourceLanguage to the original language of the evidence.

The description field must be a short recipe summary written in ${language}. Do not paste the original post caption into description; translate it.

Prefer the post description for ingredient lists, quantities, units, servings, and calories. Use transcript, OCR, and vision to complete steps when needed.

Evidence:
${evidenceText}

Extract a complete recipe from the evidence above.${nutritionInstruction}`;

    const result = await this.llm.generateStructured<ExtractedRecipe>(
      {
        messages: [
          { role: 'system', content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        ...RECIPE_EXTRACTION_SCHEMA,
        required: [...RECIPE_EXTRACTION_SCHEMA.required, 'nutrition'],
      },
    );

    return {
      recipe: result.data,
      promptVersion: RECIPE_EXTRACTION_PROMPT_VERSION,
      rawExtraction: result.data,
    };
  }
}
