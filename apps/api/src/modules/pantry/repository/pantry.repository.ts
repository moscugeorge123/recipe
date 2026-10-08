import type { PantryClassificationStatus, PantryStorageLocation, Prisma } from '@prisma/client';

export interface PantryItemRecord {
  id: string;
  userId: string;
  name: string;
  canonicalName: string | null;
  rawText: string | null;
  locale: string;
  promptVersion: string | null;
  quantity: Prisma.Decimal | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  colorToken: string | null;
  storageLocation: PantryStorageLocation;
  expiresAt: Date | null;
  classificationStatus: PantryClassificationStatus;
  classification: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePantryItemInput {
  userId: string;
  name: string;
  canonicalName?: string | null;
  rawText?: string | null;
  locale?: string;
  promptVersion?: string | null;
  quantity?: Prisma.Decimal | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  colorToken?: string | null;
  storageLocation?: PantryStorageLocation;
  expiresAt?: Date | null;
  classificationStatus?: PantryClassificationStatus;
  classification?: Prisma.InputJsonValue;
}

export interface UpdatePantryItemInput {
  name?: string;
  canonicalName?: string | null;
  rawText?: string | null;
  locale?: string;
  promptVersion?: string | null;
  quantity?: Prisma.Decimal | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  colorToken?: string | null;
  storageLocation?: PantryStorageLocation;
  expiresAt?: Date | null;
  classificationStatus?: PantryClassificationStatus;
  classification?: Prisma.InputJsonValue;
}

export interface IPantryRepository {
  list(params: {
    userId: string;
    page: number;
    pageSize: number;
    category?: string;
  }): Promise<{ items: PantryItemRecord[]; total: number }>;
  findById(id: string, userId: string): Promise<PantryItemRecord | null>;
  findByCanonicalName(userId: string, canonicalName: string): Promise<PantryItemRecord | null>;
  create(input: CreatePantryItemInput): Promise<PantryItemRecord>;
  update(id: string, userId: string, input: UpdatePantryItemInput): Promise<PantryItemRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
