import { Prisma } from '@prisma/client';

import { buildPaginationMeta } from '../../../shared/pagination/pagination.js';
import { PantryItemNotFoundError } from '../../../shared/errors/pantry-errors.js';
import { normalizeIngredientName } from '../../normalization/domain/units.js';
import { resolveIngredientPresentation } from '../../normalization/domain/presentation.js';
import { toSentenceCase } from '../../normalization/domain/casing.js';
import type { IngredientOrganizer, OrganizeResult } from './ingredient-organizer.js';
import type {
  CreatePantryItemInput,
  IPantryRepository,
  PantryItemRecord,
} from '../repository/pantry.repository.js';
import type {
  CreatePantryItemsBody,
  ListPantryQuery,
  OrganizePantryBody,
  PatchPantryItemBody,
} from '../api/pantry.schema.js';

export interface PantryItemView {
  id: string;
  name: string;
  canonicalName: string | null;
  rawText: string | null;
  locale: string;
  promptVersion: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  colorToken: string | null;
  storageLocation: PantryItemRecord['storageLocation'];
  expiresAt: Date | null;
  classification: {
    status: PantryItemRecord['classificationStatus'];
    canonicalName?: string;
    category?: string;
    confidence?: number;
    source?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

function toQuantity(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function readClassification(record: PantryItemRecord): PantryItemView['classification'] {
  const raw =
    record.classification && typeof record.classification === 'object' && !Array.isArray(record.classification)
      ? (record.classification as Record<string, unknown>)
      : {};
  const classification: PantryItemView['classification'] = {
    status: record.classificationStatus,
  };
  if (typeof raw['canonicalName'] === 'string') {
    classification.canonicalName = raw['canonicalName'];
  } else if (record.canonicalName) {
    classification.canonicalName = record.canonicalName;
  }
  if (typeof raw['category'] === 'string') {
    classification.category = raw['category'];
  } else if (record.category) {
    classification.category = record.category;
  }
  if (typeof raw['confidence'] === 'number') {
    classification.confidence = raw['confidence'];
  }
  if (typeof raw['source'] === 'string') {
    classification.source = raw['source'];
  }
  return classification;
}

function toView(record: PantryItemRecord): PantryItemView {
  return {
    id: record.id,
    name: record.name,
    canonicalName: record.canonicalName,
    rawText: record.rawText,
    locale: record.locale,
    promptVersion: record.promptVersion,
    quantity: toQuantity(record.quantity),
    unit: record.unit,
    category: record.category,
    emoji: record.emoji,
    colorToken: record.colorToken,
    storageLocation: record.storageLocation,
    expiresAt: record.expiresAt,
    classification: readClassification(record),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function classificationJson(input: {
  status: string;
  canonicalName: string;
  category: string;
  confidence: number;
  source: string;
}): Prisma.InputJsonValue {
  return {
    status: input.status,
    canonicalName: input.canonicalName,
    category: input.category,
    confidence: input.confidence,
    source: input.source,
  };
}

export class PantryService {
  constructor(
    private readonly repo: IPantryRepository,
    private readonly organizer: IngredientOrganizer,
  ) {}

  organize(userId: string, body: OrganizePantryBody): Promise<OrganizeResult> {
    return this.organizer.organize({
      text: body.text,
      userId,
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    });
  }

  async list(
    userId: string,
    query: ListPantryQuery,
  ): Promise<{ items: PantryItemView[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { items, total } = await this.repo.list({
      userId,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.category !== undefined ? { category: query.category } : {}),
    });
    return {
      items: items.map(toView),
      meta: buildPaginationMeta(query, total),
    };
  }

  async createMany(userId: string, body: CreatePantryItemsBody): Promise<PantryItemView[]> {
    const created: PantryItemView[] = [];
    for (const item of body.items) {
      created.push(await this.upsertOne(userId, item));
    }
    return created;
  }

  async update(userId: string, id: string, body: PatchPantryItemBody): Promise<PantryItemView> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) {
      throw new PantryItemNotFoundError();
    }

    const name = body.name ?? existing.name;
    const presentation = resolveIngredientPresentation({
      name,
      category: body.category ?? existing.category,
      emoji: body.emoji ?? existing.emoji,
      colorToken: body.colorToken ?? existing.colorToken,
    });
    const canonicalName = normalizeIngredientName(body.canonicalName ?? name);
    const updated = await this.repo.update(id, userId, {
      name: toSentenceCase(name),
      canonicalName,
      ...(body.rawText !== undefined ? { rawText: body.rawText } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
      ...(body.promptVersion !== undefined ? { promptVersion: body.promptVersion } : {}),
      ...(body.quantity !== undefined
        ? { quantity: body.quantity === null ? null : new Prisma.Decimal(body.quantity) }
        : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      category: presentation.category,
      emoji: presentation.emoji,
      colorToken: presentation.colorToken,
      ...(body.storageLocation !== undefined ? { storageLocation: body.storageLocation } : {}),
      ...(body.expiresAt !== undefined
        ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
        : {}),
      classificationStatus: body.status ?? 'CLASSIFIED',
      classification: classificationJson({
        status: body.status ?? 'CLASSIFIED',
        canonicalName,
        category: presentation.category,
        confidence: body.confidence ?? 1,
        source: body.source ?? 'user',
      }),
    });
    if (!updated) {
      throw new PantryItemNotFoundError();
    }
    return toView(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new PantryItemNotFoundError();
    }
  }

  private async upsertOne(
    userId: string,
    item: CreatePantryItemsBody['items'][number],
  ): Promise<PantryItemView> {
    const presentation = resolveIngredientPresentation({
      name: item.name,
      category: item.category,
      emoji: item.emoji,
      colorToken: item.colorToken,
    });
    const canonicalName = normalizeIngredientName(item.canonicalName ?? item.name);
    const payload: CreatePantryItemInput = {
      userId,
      name: toSentenceCase(item.name),
      canonicalName,
      rawText: item.rawText ?? item.name,
      locale: item.locale ?? 'en',
      promptVersion: item.promptVersion ?? null,
      quantity: item.quantity === undefined || item.quantity === null ? null : new Prisma.Decimal(item.quantity),
      unit: item.unit ?? null,
      category: presentation.category,
      emoji: presentation.emoji,
      colorToken: presentation.colorToken,
      ...(item.storageLocation !== undefined ? { storageLocation: item.storageLocation } : {}),
      ...(item.expiresAt ? { expiresAt: new Date(item.expiresAt) } : {}),
      classificationStatus: item.status ?? 'CLASSIFIED',
      classification: classificationJson({
        status: item.status ?? 'CLASSIFIED',
        canonicalName,
        category: presentation.category,
        confidence: item.confidence ?? 1,
        source: item.source ?? 'user',
      }),
    };

    const existing = await this.repo.findByCanonicalName(userId, canonicalName);
    if (existing) {
      const updated = await this.repo.update(existing.id, userId, {
        name: payload.name,
        rawText: existing.rawText
          ? `${existing.rawText}\n${payload.rawText ?? ''}`.trim()
          : (payload.rawText ?? existing.name),
        quantity:
          existing.quantity && payload.quantity
            ? new Prisma.Decimal(Number(existing.quantity) + Number(payload.quantity))
            : (payload.quantity ?? existing.quantity),
        unit: payload.unit ?? existing.unit,
        category: presentation.category,
        emoji: presentation.emoji,
        colorToken: presentation.colorToken,
        classificationStatus: item.status ?? 'CLASSIFIED',
        ...(payload.classification !== undefined ? { classification: payload.classification } : {}),
      });
      if (!updated) {
        throw new PantryItemNotFoundError();
      }
      return toView(updated);
    }

    return toView(await this.repo.create(payload));
  }
}
