import type { LLMInput, LLMProvider, LLMResult } from './llm-provider.js';

/** Deterministic LLM for tests and pipeline runs without an API key. */
export class MockLLMProvider implements LLMProvider {
  constructor(private readonly responses: Map<string, unknown> = new Map()) {}

  setResponse(key: string, data: unknown): void {
    this.responses.set(key, data);
  }

  async generateStructured<T>(
    input: LLMInput,
    _schema: Record<string, unknown>,
  ): Promise<LLMResult<T>> {
    void _schema;
    const userContent = input.messages.find((m) => m.role === 'user')?.content ?? '';
    const key = this.extractFixtureKey(userContent);
    const preset = this.responses.get(key);

    if (preset) {
      return {
        data: preset as T,
        model: 'mock-llm',
        usage: { inputTokens: 100, outputTokens: 200 },
        durationMs: 1,
      };
    }

    const data = this.extractFromEvidence(userContent) as T;
    return {
      data,
      model: 'mock-llm',
      usage: { inputTokens: 100, outputTokens: 200 },
      durationMs: 1,
    };
  }

  private extractFixtureKey(content: string): string {
    const match = /fixture:([a-z0-9-]+)/i.exec(content);
    return match?.[1] ?? '';
  }

  private extractFromEvidence(content: string): Record<string, unknown> {
    const titleMatch = /Title:\s*(.+)/m.exec(content);
    const postDescriptionMatch =
      /Post description[^\n]*:\s*([\s\S]*?)(?=\n\n[A-Z][a-z]+:|\nTranscript:|\nOCR:|\nVision:|$)/m.exec(
        content,
      );
    const captionMatch = /Caption:\s*(.+)/m.exec(content);
    const transcriptMatch = /Transcript:\s*(.+)/m.exec(content);

    const title = titleMatch?.[1]?.trim() ?? captionMatch?.[1]?.slice(0, 80).trim() ?? 'Extracted Recipe';
    const description =
      postDescriptionMatch?.[1]?.replace(/^-\s*/gm, '').trim() ||
      captionMatch?.[1]?.trim() ||
      transcriptMatch?.[1]?.trim() ||
      '';

    const caloriesMatch = /(?:calories?|kcal)\s*[:=]?\s*(\d{2,5})/i.exec(description);
    const calories = caloriesMatch?.[1] ? Number.parseInt(caloriesMatch[1], 10) : null;

    const ingredients: Record<string, unknown>[] = [];
    const ingredientSection = /Ingredients:\s*([\s\S]*?)(?=Steps:|$)/m.exec(content);
    if (ingredientSection?.[1]) {
      for (const line of ingredientSection[1].split('\n')) {
        const trimmed = line.replace(/^[-*]\s*/, '').trim();
        if (trimmed) {
          ingredients.push({ name: trimmed, sortOrder: ingredients.length, confidence: 0.7 });
        }
      }
    }

    if (ingredients.length === 0 && description) {
      const qtyMatch = /(\d+\s*(?:g|ml|cup|cups|tbsp|tsp)?)\s+(\w+)/gi.exec(description);
      if (qtyMatch) {
        ingredients.push({
          name: qtyMatch[2] ?? 'ingredient',
          quantity: qtyMatch[1],
          sortOrder: 0,
          confidence: 0.6,
        });
      } else {
        ingredients.push({ name: 'main ingredient', sortOrder: 0, confidence: 0.5 });
      }
    }

    const steps: Record<string, unknown>[] = [];
    const stepsSection = /Steps:\s*([\s\S]*?)$/m.exec(content);
    if (stepsSection?.[1]) {
      for (const line of stepsSection[1].split('\n')) {
        const trimmed = line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim();
        if (trimmed) {
          steps.push({ stepOrder: steps.length + 1, instruction: trimmed, confidence: 0.7 });
        }
      }
    }

    if (steps.length === 0 && description) {
      steps.push({ stepOrder: 1, instruction: description, confidence: 0.5 });
    }

    return {
      title,
      description,
      calories,
      sourceLanguage: 'en',
      ingredients,
      steps,
    };
  }
}
