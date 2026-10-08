import type { Prisma, PrismaClient } from '@prisma/client';

import type {
  CreatePantryItemInput,
  IPantryRepository,
  PantryItemRecord,
  UpdatePantryItemInput,
} from '../../../modules/pantry/repository/pantry.repository.js';

export class PrismaPantryRepository implements IPantryRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(params: {
    userId: string;
    page: number;
    pageSize: number;
    category?: string;
  }): Promise<{ items: PantryItemRecord[]; total: number }> {
    const where = {
      userId: params.userId,
      ...(params.category !== undefined ? { category: params.category } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.pantryItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.db.pantryItem.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string, userId: string): Promise<PantryItemRecord | null> {
    return this.db.pantryItem.findFirst({ where: { id, userId } });
  }

  findByCanonicalName(userId: string, canonicalName: string): Promise<PantryItemRecord | null> {
    return this.db.pantryItem.findFirst({
      where: { userId, canonicalName },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(input: CreatePantryItemInput): Promise<PantryItemRecord> {
    return this.db.pantryItem.create({
      data: {
        userId: input.userId,
        name: input.name,
        canonicalName: input.canonicalName ?? null,
        rawText: input.rawText ?? input.name,
        locale: input.locale ?? 'en',
        promptVersion: input.promptVersion ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        category: input.category ?? null,
        emoji: input.emoji ?? null,
        colorToken: input.colorToken ?? null,
        ...(input.storageLocation !== undefined ? { storageLocation: input.storageLocation } : {}),
        expiresAt: input.expiresAt ?? null,
        ...(input.classificationStatus !== undefined
          ? { classificationStatus: input.classificationStatus }
          : {}),
        ...(input.classification !== undefined ? { classification: input.classification } : {}),
      },
    });
  }

  async update(id: string, userId: string, input: UpdatePantryItemInput): Promise<PantryItemRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return null;
    }
    const data: Prisma.PantryItemUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.canonicalName !== undefined) data.canonicalName = input.canonicalName;
    if (input.rawText !== undefined) data.rawText = input.rawText;
    if (input.locale !== undefined) data.locale = input.locale;
    if (input.promptVersion !== undefined) data.promptVersion = input.promptVersion;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.category !== undefined) data.category = input.category;
    if (input.emoji !== undefined) data.emoji = input.emoji;
    if (input.colorToken !== undefined) data.colorToken = input.colorToken;
    if (input.storageLocation !== undefined) data.storageLocation = input.storageLocation;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;
    if (input.classificationStatus !== undefined) {
      data.classificationStatus = input.classificationStatus;
    }
    if (input.classification !== undefined) data.classification = input.classification;
    return this.db.pantryItem.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.pantryItem.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}
