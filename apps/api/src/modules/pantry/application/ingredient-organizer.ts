import { z } from 'zod';

import type { AppConfig } from '../../../config/env.js';
import type { LLMProvider } from '../../../infrastructure/ai/llm/llm-provider.js';
import type { AIUsageTracker } from '../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { toSentenceCase } from '../../normalization/domain/casing.js';
import { INGREDIENT_CATEGORIES } from '../../normalization/domain/presentation-heuristics.js';
import {
  GARDEN_PLATE_COLOR_TOKENS,
  resolveIngredientPresentation,
} from '../../normalization/domain/presentation.js';
import { normalizeIngredientName } from '../../normalization/domain/units.js';
import {
  classificationCacheKey,
  type CachedClassification,
  type ClassificationCache,
} from './classification-cache.js';
import { dictionaryDisplayName, lookupIngredientDictionary } from './ingredient-dictionary.js';
import { estimateTokenCount, parsePantryText, type ParsedPantryLine } from './parse-pantry-text.js';

export const INGREDIENT_ORGANIZE_PROMPT_VERSION = 'ingredient-enrichment-v1';

export type OrganizeSource = 'dictionary' | 'cache' | 'ai' | 'fallback';

export interface OrganizedPantryItem {
  rawText: string;
  name: string;
  canonicalName: string;
  category: string;
  emoji: string;
  colorToken: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  source: OrganizeSource;
  status: 'CLASSIFIED' | 'NEEDS_REVIEW' | 'FAILED';
  locale: string;
  promptVersion: string;
}

export interface UnresolvedPantryLine {
  rawText: string;
  reason: 'budget' | 'ai_unavailable' | 'malformed' | 'low_confidence';
  retryable: boolean;
}

export interface OrganizeMeta {
  promptVersion: string;
  cacheHits: number;
  dictionaryHits: number;
  aiItemCount: number;
  modelsUsed: string[];
  escalatedCount: number;
  fallbackCount: number;
  truncated: boolean;
  aiAvailable: boolean;
}

export interface OrganizeResult {
  items: OrganizedPantryItem[];
  unresolved: UnresolvedPantryLine[];
  meta: OrganizeMeta;
}

export interface OrganizeInput {
  text: string;
  locale?: string;
  userId: string;
}

interface CompactAiItem {
  i: number;
  n: string;
  c: string;
  e: string;
  t: string;
  q: number | null;
  u: string | null;
  k: number;
}

const compactItemSchema = z.object({
  i: z.number().int(),
  n: z.string().min(1),
  c: z.enum(INGREDIENT_CATEGORIES),
  e: z.string(),
  t: z.enum(GARDEN_PLATE_COLOR_TOKENS),
  q: z.number().nullable(),
  u: z.string().nullable(),
  k: z.number(),
});

const compactBatchSchema = z.object({
  items: z.array(compactItemSchema),
});

export const INGREDIENT_ORGANIZE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          n: { type: 'string' },
          c: { type: 'string', enum: [...INGREDIENT_CATEGORIES] },
          e: { type: 'string' },
          t: { type: 'string', enum: [...GARDEN_PLATE_COLOR_TOKENS] },
          q: { type: ['number', 'null'] },
          u: { type: ['string', 'null'] },
          k: { type: 'number' },
        },
        required: ['i', 'n', 'c', 'e', 't', 'q', 'u', 'k'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  'Classify grocery items. JSON only. No prose. One emoji grapheme. Garden Plate colorToken.';

function isForbiddenModel(model: string): boolean {
  return /gpt-5\.6/i.test(model);
}

function isEscalationOnlyModel(model: string): boolean {
  return /gpt-4o-mini/i.test(model) || isForbiddenModel(model);
}

function batchModel(candidate: string, fallback: string): string | null {
  if (!isEscalationOnlyModel(candidate)) {
    return candidate;
  }
  if (!isEscalationOnlyModel(fallback)) {
    return fallback;
  }
  return null;
}

function toOrganized(
  line: ParsedPantryLine,
  input: {
    name: string;
    canonicalName: string;
    category: string;
    emoji: string;
    colorToken: string;
    quantity: number | null;
    unit: string | null;
    confidence: number;
    source: OrganizeSource;
    status: OrganizedPantryItem['status'];
    locale: string;
    promptVersion: string;
  },
): OrganizedPantryItem {
  const presentation = resolveIngredientPresentation({
    name: input.name,
    category: input.category,
    emoji: input.emoji,
    colorToken: input.colorToken,
  });
  return {
    rawText: line.rawText,
    name: toSentenceCase(input.name),
    canonicalName: input.canonicalName,
    category: presentation.category,
    emoji: presentation.emoji,
    colorToken: presentation.colorToken,
    quantity: input.quantity ?? line.quantity,
    unit: input.unit ?? line.unit,
    confidence: input.confidence,
    source: input.source,
    status: input.status,
    locale: input.locale,
    promptVersion: input.promptVersion,
  };
}

function fallbackItem(
  line: ParsedPantryLine,
  locale: string,
  promptVersion: string,
  status: OrganizedPantryItem['status'] = 'NEEDS_REVIEW',
): OrganizedPantryItem {
  const presentation = resolveIngredientPresentation({ name: line.remainder });
  return toOrganized(line, {
    name: line.remainder,
    canonicalName: normalizeIngredientName(line.remainder),
    category: presentation.category,
    emoji: presentation.emoji,
    colorToken: presentation.colorToken,
    quantity: line.quantity,
    unit: line.unit,
    confidence: 0.35,
    source: 'fallback',
    status,
    locale,
    promptVersion,
  });
}

function fromCache(
  line: ParsedPantryLine,
  cached: CachedClassification,
  locale: string,
  promptVersion: string,
): OrganizedPantryItem {
  return toOrganized(line, {
    name: cached.displayName,
    canonicalName: cached.canonicalName,
    category: cached.category,
    emoji: cached.emoji,
    colorToken: cached.colorToken,
    quantity: line.quantity,
    unit: line.unit,
    confidence: cached.confidence,
    source: cached.source === 'dictionary' ? 'dictionary' : 'cache',
    status: cached.confidence < 0.55 ? 'NEEDS_REVIEW' : 'CLASSIFIED',
    locale,
    promptVersion,
  });
}

function fromDictionary(
  line: ParsedPantryLine,
  locale: string,
  promptVersion: string,
): OrganizedPantryItem | null {
  const entry = lookupIngredientDictionary(line.remainder);
  if (!entry) {
    return null;
  }
  return toOrganized(line, {
    name: dictionaryDisplayName(entry, line.remainder),
    canonicalName: entry.canonicalName,
    category: entry.category,
    emoji: entry.emoji,
    colorToken: entry.colorToken,
    quantity: line.quantity,
    unit: line.unit,
    confidence: 0.99,
    source: 'dictionary',
    status: 'CLASSIFIED',
    locale,
    promptVersion,
  });
}

function fromAiItem(
  line: ParsedPantryLine,
  ai: CompactAiItem,
  locale: string,
  promptVersion: string,
): OrganizedPantryItem {
  const presentation = resolveIngredientPresentation({
    name: ai.n,
    category: ai.c,
    emoji: ai.e,
    colorToken: ai.t,
  });
  const confidence = Number.isFinite(ai.k) ? ai.k : 0.5;
  return toOrganized(line, {
    name: ai.n,
    canonicalName: normalizeIngredientName(ai.n),
    category: presentation.category,
    emoji: presentation.emoji,
    colorToken: presentation.colorToken,
    quantity: ai.q,
    unit: ai.u,
    confidence,
    source: 'ai',
    status: confidence < 0.55 ? 'NEEDS_REVIEW' : 'CLASSIFIED',
    locale,
    promptVersion,
  });
}

function dedupeItems(items: OrganizedPantryItem[]): OrganizedPantryItem[] {
  const byCanonical = new Map<string, OrganizedPantryItem>();
  for (const item of items) {
    const key = item.canonicalName.trim().toLowerCase();
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, item);
      continue;
    }
    const rawTexts = new Set(
      [...existing.rawText.split('\n'), ...item.rawText.split('\n')].map((value) => value.trim()),
    );
    byCanonical.set(key, {
      ...existing,
      rawText: [...rawTexts].join('\n'),
      quantity:
        existing.quantity !== null && item.quantity !== null
          ? existing.quantity + item.quantity
          : (existing.quantity ?? item.quantity),
      confidence: Math.max(existing.confidence, item.confidence),
    });
  }
  return [...byCanonical.values()];
}

function buildUserPrompt(locale: string, promptVersion: string, lines: ParsedPantryLine[]): string {
  const body = lines.map((line) => `${String(line.index)}\t${line.remainder}`).join('\n');
  return `LOCALE ${locale}\nVERSION ${promptVersion}\n${body}`;
}

export class IngredientOrganizer {
  constructor(
    private readonly config: AppConfig,
    private readonly cache: ClassificationCache,
    private readonly llm: LLMProvider | null,
    private readonly usageTracker: AIUsageTracker | null,
  ) {}

  async organize(input: OrganizeInput): Promise<OrganizeResult> {
    const locale = (input.locale ?? 'en').trim() || 'en';
    const promptVersion = this.config.ai.ingredientPromptVersion;
    const parsed = parsePantryText(input.text);
    const maxItems = this.config.ai.ingredientMaxItems;
    const inBudget = parsed.slice(0, maxItems);
    const overflow = parsed.slice(maxItems);

    const items: OrganizedPantryItem[] = [];
    const unresolved: UnresolvedPantryLine[] = overflow.map((line) => ({
      rawText: line.rawText,
      reason: 'budget',
      retryable: true,
    }));
    let cacheHits = 0;
    let dictionaryHits = 0;
    const unknown: ParsedPantryLine[] = [];

    for (const line of inBudget) {
      const dictionary = fromDictionary(line, locale, promptVersion);
      if (dictionary) {
        dictionaryHits += 1;
        items.push(dictionary);
        await this.cache.set(classificationCacheKey(line.remainder, locale, promptVersion), {
          canonicalName: dictionary.canonicalName,
          displayName: dictionary.name,
          category: dictionary.category,
          emoji: dictionary.emoji,
          colorToken: dictionary.colorToken,
          confidence: dictionary.confidence,
          source: 'dictionary',
          promptVersion,
        });
        continue;
      }

      const cached = await this.cache.get(
        classificationCacheKey(line.remainder, locale, promptVersion),
      );
      if (cached) {
        cacheHits += 1;
        items.push(fromCache(line, cached, locale, promptVersion));
        continue;
      }

      unknown.push(line);
    }

    const modelsUsed: string[] = [];
    let escalatedCount = 0;
    let fallbackCount = 0;
    let aiItemCount = 0;
    const aiAvailable = this.llm !== null;

    const classifiedUnknown = await this.classifyUnknown(unknown, {
      locale,
      promptVersion,
      userId: input.userId,
      modelsUsed,
    });
    aiItemCount = classifiedUnknown.aiItemCount;
    escalatedCount = classifiedUnknown.escalatedCount;
    fallbackCount = classifiedUnknown.fallbackCount;
    items.push(...classifiedUnknown.items);
    unresolved.push(...classifiedUnknown.unresolved);

    if (cacheHits > 0 && this.usageTracker) {
      await this.usageTracker.track({
        userId: input.userId,
        provider: 'cache',
        model: promptVersion,
        operation: 'pantry_organize_cache',
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
      });
    }

    return {
      items: dedupeItems(items),
      unresolved,
      meta: {
        promptVersion,
        cacheHits,
        dictionaryHits,
        aiItemCount,
        modelsUsed,
        escalatedCount,
        fallbackCount,
        truncated: overflow.length > 0,
        aiAvailable,
      },
    };
  }

  private async classifyUnknown(
    unknown: ParsedPantryLine[],
    ctx: { locale: string; promptVersion: string; userId: string; modelsUsed: string[] },
  ): Promise<{
    items: OrganizedPantryItem[];
    unresolved: UnresolvedPantryLine[];
    aiItemCount: number;
    escalatedCount: number;
    fallbackCount: number;
  }> {
    if (unknown.length === 0) {
      return { items: [], unresolved: [], aiItemCount: 0, escalatedCount: 0, fallbackCount: 0 };
    }

    if (!this.llm) {
      return {
        items: unknown.map((line) => fallbackItem(line, ctx.locale, ctx.promptVersion)),
        unresolved: unknown.map((line) => ({
          rawText: line.rawText,
          reason: 'ai_unavailable',
          retryable: true,
        })),
        aiItemCount: 0,
        escalatedCount: 0,
        fallbackCount: unknown.length,
      };
    }

    const tokenBudget = this.config.ai.ingredientMaxInputTokens;
    const batchLines: ParsedPantryLine[] = [];
    const overToken: ParsedPantryLine[] = [];
    for (const line of unknown) {
      const candidate = [...batchLines, line];
      const prompt = buildUserPrompt(ctx.locale, ctx.promptVersion, candidate);
      if (
        batchLines.length > 0 &&
        estimateTokenCount(SYSTEM_PROMPT + prompt) > tokenBudget
      ) {
        overToken.push(line);
        continue;
      }
      batchLines.push(line);
    }

    const unresolved: UnresolvedPantryLine[] = overToken.map((line) => ({
      rawText: line.rawText,
      reason: 'budget',
      retryable: true,
    }));
    const items: OrganizedPantryItem[] = overToken.map((line) =>
      fallbackItem(line, ctx.locale, ctx.promptVersion),
    );

    const byIndex = new Map(batchLines.map((line) => [line.index, line]));
    const remaining = new Map(byIndex);

    const primary = batchModel(
      this.config.ai.ingredientModel,
      this.config.ai.ingredientFallbackModel,
    );
    const fallback =
      this.config.ai.ingredientFallbackModel !== primary &&
      !isEscalationOnlyModel(this.config.ai.ingredientFallbackModel)
        ? this.config.ai.ingredientFallbackModel
        : null;

    let batchOutcome = primary
      ? await this.runBatch(batchLines, primary, 'pantry_organize_batch', ctx)
      : null;
    if (
      primary &&
      fallback &&
      (batchOutcome === null || batchOutcome === 'malformed')
    ) {
      const retry = await this.runBatch(batchLines, fallback, 'pantry_organize_fallback', ctx);
      if (retry !== null) {
        batchOutcome = retry;
      }
    }
    if (batchOutcome && batchOutcome !== 'malformed') {
      this.applyBatch(batchOutcome, remaining, items, ctx);
    }

    const stillMissing = [...remaining.values()];
    const lowConfidence = items.filter(
      (item) =>
        item.source === 'ai' && item.confidence < this.config.ai.ingredientLowConfidence,
    );

    const toEscalate = [...stillMissing];
    for (const item of lowConfidence) {
      const line = batchLines.find((candidate) => candidate.rawText === item.rawText);
      if (line) {
        toEscalate.push(line);
      }
    }

    let escalatedCount = 0;
    const escalationModel = this.config.ai.ingredientEscalationModel;
    const maxEscalations = this.config.ai.ingredientMaxEscalations;
    if (/gpt-4o-mini/i.test(escalationModel) && !isForbiddenModel(escalationModel)) {
      for (const line of toEscalate.slice(0, maxEscalations)) {
        const escalated = await this.runSingle(line, escalationModel, ctx);
        escalatedCount += 1;
        if (escalated) {
          remaining.delete(line.index);
          const idx = items.findIndex((item) => item.rawText === line.rawText);
          if (idx >= 0) {
            items[idx] = escalated;
          } else {
            items.push(escalated);
          }
          const unresolvedIdx = unresolved.findIndex((entry) => entry.rawText === line.rawText);
          if (unresolvedIdx >= 0) {
            unresolved.splice(unresolvedIdx, 1);
          }
        }
      }
    }

    let fallbackCount = overToken.length;
    for (const line of remaining.values()) {
      if (!items.some((item) => item.rawText === line.rawText)) {
        items.push(fallbackItem(line, ctx.locale, ctx.promptVersion));
        fallbackCount += 1;
        unresolved.push({
          rawText: line.rawText,
          reason: batchOutcome === 'malformed' ? 'malformed' : 'ai_unavailable',
          retryable: true,
        });
      }
    }

    return {
      items,
      unresolved,
      aiItemCount: batchLines.length,
      escalatedCount,
      fallbackCount,
    };
  }

  private applyBatch(
    parsed: CompactAiItem[],
    remaining: Map<number, ParsedPantryLine>,
    items: OrganizedPantryItem[],
    ctx: { locale: string; promptVersion: string },
  ): void {
    for (const ai of parsed) {
      const line = remaining.get(ai.i);
      if (!line) {
        continue;
      }
      const organized = fromAiItem(line, ai, ctx.locale, ctx.promptVersion);
      items.push(organized);
      remaining.delete(ai.i);
      void this.cache.set(classificationCacheKey(line.remainder, ctx.locale, ctx.promptVersion), {
        canonicalName: organized.canonicalName,
        displayName: organized.name,
        category: organized.category,
        emoji: organized.emoji,
        colorToken: organized.colorToken,
        confidence: organized.confidence,
        source: 'ai',
        promptVersion: ctx.promptVersion,
      });
    }
  }

  private async runBatch(
    lines: ParsedPantryLine[],
    model: string,
    operation: string,
    ctx: { locale: string; promptVersion: string; userId: string; modelsUsed: string[] },
  ): Promise<CompactAiItem[] | 'malformed' | null> {
    if (!this.llm || lines.length === 0 || isForbiddenModel(model) || isEscalationOnlyModel(model)) {
      return null;
    }
    ctx.modelsUsed.push(model);
    const startedAt = Date.now();
    try {
      const result = await this.llm.generateStructured<unknown>(
        {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: buildUserPrompt(ctx.locale, ctx.promptVersion, lines),
            },
          ],
          model,
          maxTokens: this.config.ai.ingredientMaxOutputTokens,
          reasoningEffort: this.config.ai.ingredientReasoningEffort,
        },
        INGREDIENT_ORGANIZE_JSON_SCHEMA,
      );
      await this.track(ctx.userId, model, operation, result.usage.inputTokens, result.usage.outputTokens, result.durationMs);
      const parsed = compactBatchSchema.safeParse(result.data);
      if (!parsed.success) {
        return 'malformed';
      }
      return parsed.data.items;
    } catch {
      await this.track(ctx.userId, model, operation, 0, 0, Date.now() - startedAt);
      return null;
    }
  }

  private async runSingle(
    line: ParsedPantryLine,
    model: string,
    ctx: { locale: string; promptVersion: string; userId: string; modelsUsed: string[] },
  ): Promise<OrganizedPantryItem | null> {
    if (!this.llm || isForbiddenModel(model)) {
      return null;
    }
    ctx.modelsUsed.push(model);
    const startedAt = Date.now();
    try {
      const result = await this.llm.generateStructured<unknown>(
        {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: buildUserPrompt(ctx.locale, ctx.promptVersion, [line]),
            },
          ],
          model,
          maxTokens: Math.min(256, this.config.ai.ingredientMaxOutputTokens),
          reasoningEffort: this.config.ai.ingredientReasoningEffort,
        },
        INGREDIENT_ORGANIZE_JSON_SCHEMA,
      );
      await this.track(
        ctx.userId,
        model,
        'pantry_organize_escalation',
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.durationMs,
      );
      const parsed = compactBatchSchema.safeParse(result.data);
      const ai = parsed.success ? parsed.data.items[0] : undefined;
      if (!ai) {
        return null;
      }
      const organized = fromAiItem(line, { ...ai, i: line.index }, ctx.locale, ctx.promptVersion);
      await this.cache.set(classificationCacheKey(line.remainder, ctx.locale, ctx.promptVersion), {
        canonicalName: organized.canonicalName,
        displayName: organized.name,
        category: organized.category,
        emoji: organized.emoji,
        colorToken: organized.colorToken,
        confidence: organized.confidence,
        source: 'ai',
        promptVersion: ctx.promptVersion,
      });
      return organized;
    } catch {
      await this.track(ctx.userId, model, 'pantry_organize_escalation', 0, 0, Date.now() - startedAt);
      return null;
    }
  }

  private async track(
    userId: string,
    model: string,
    operation: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number,
  ): Promise<void> {
    if (!this.usageTracker) {
      return;
    }
    await this.usageTracker.track({
      userId,
      provider: 'openai',
      model,
      operation,
      inputTokens,
      outputTokens,
      durationMs,
    });
  }
}
