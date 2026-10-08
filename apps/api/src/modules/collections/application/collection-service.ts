import { Prisma } from '@prisma/client';

import { ValidationError } from '../../../shared/errors/app-error.js';
import {
  CollectionMemberNotFoundError,
  CollectionNameConflictError,
  CollectionNotFoundError,
} from '../../../shared/errors/collection-errors.js';
import { RecipeNotFoundError } from '../../../shared/errors/recipe-errors.js';
import { buildPaginationMeta } from '../../../shared/pagination/pagination.js';
import type {
  AddCollectionRecipeBody,
  CreateCollectionBody,
  ListCollectionsQuery,
  PatchCollectionBody,
  ReorderCollectionRecipesBody,
} from '../api/collections.schema.js';
import type {
  CollectionDetailRecord,
  CollectionRecord,
  ICollectionRepository,
} from '../repository/collection.repository.js';

export type CollectionView = CollectionDetailRecord;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function uniqueRecipeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function sameMembership(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const expected = new Set(left);
  return right.every((id) => expected.has(id));
}

export class CollectionService {
  constructor(private readonly repo: ICollectionRepository) {}

  async list(
    userId: string,
    query: ListCollectionsQuery,
  ): Promise<{ items: CollectionRecord[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { items, total } = await this.repo.list({
      userId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items, meta: buildPaginationMeta(query, total) };
  }

  async getById(userId: string, id: string): Promise<CollectionView> {
    const collection = await this.repo.findById(id, userId);
    if (!collection) {
      throw new CollectionNotFoundError();
    }
    return collection;
  }

  async create(userId: string, body: CreateCollectionBody): Promise<CollectionView> {
    const name = body.name.trim();
    await this.assertUniqueName(userId, name);
    const recipeIds = uniqueRecipeIds(body.recipeIds ?? []);
    const members = await this.resolveMembers(userId, recipeIds);
    try {
      return await this.repo.create({
        userId,
        name,
        description: body.description ?? null,
        members,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new CollectionNameConflictError();
      }
      throw error;
    }
  }

  async update(userId: string, id: string, body: PatchCollectionBody): Promise<CollectionView> {
    if (body.name !== undefined) {
      await this.assertUniqueName(userId, body.name.trim(), id);
    }
    try {
      const updated = await this.repo.update(id, userId, {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      });
      if (!updated) {
        throw new CollectionNotFoundError();
      }
      return updated;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new CollectionNameConflictError();
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new CollectionNotFoundError();
    }
  }

  async addRecipe(
    userId: string,
    collectionId: string,
    body: AddCollectionRecipeBody,
  ): Promise<{ collection: CollectionView; created: boolean }> {
    const collection = await this.requireCollection(userId, collectionId);
    const owned = await this.repo.findUserRecipe(userId, body.recipeId);
    if (!owned) {
      throw new RecipeNotFoundError();
    }
    if (collection.recipes.some((member) => member.userRecipeId === owned.id)) {
      return { collection, created: false };
    }
    const next = await this.repo.addMember(
      collectionId,
      userId,
      owned.id,
      (await this.repo.maxSortOrder(collectionId)) + 1,
    );
    if (!next) {
      throw new CollectionNotFoundError();
    }
    return { collection: next, created: true };
  }

  async removeRecipe(userId: string, collectionId: string, recipeId: string): Promise<CollectionView> {
    const collection = await this.requireCollection(userId, collectionId);
    const owned = await this.repo.findUserRecipe(userId, recipeId);
    if (!owned || !collection.recipes.some((member) => member.userRecipeId === owned.id)) {
      throw new CollectionMemberNotFoundError();
    }
    const next = await this.repo.removeMember(collectionId, userId, owned.id);
    if (!next) {
      throw new CollectionNotFoundError();
    }
    return next;
  }

  async reorder(
    userId: string,
    collectionId: string,
    body: ReorderCollectionRecipesBody,
  ): Promise<CollectionView> {
    const collection = await this.requireCollection(userId, collectionId);
    const recipeIds = uniqueRecipeIds(body.recipeIds);
    if (recipeIds.length !== body.recipeIds.length) {
      throw new ValidationError({ message: 'recipeIds must not contain duplicates' });
    }
    const currentIds = collection.recipes.map((member) => member.id);
    if (!sameMembership(currentIds, recipeIds)) {
      throw new ValidationError({
        message: 'recipeIds must be a permutation of the collection membership',
      });
    }
    const owned = await this.repo.listUserRecipes(userId, recipeIds);
    const byRecipeId = new Map(owned.map((item) => [item.recipeId, item.id]));
    const userRecipeIds = recipeIds.map((recipeId) => {
      const id = byRecipeId.get(recipeId);
      if (!id) {
        throw new RecipeNotFoundError();
      }
      return id;
    });
    const next = await this.repo.reorderMembers(collectionId, userId, userRecipeIds);
    if (!next) {
      throw new CollectionNotFoundError();
    }
    return next;
  }

  private async requireCollection(userId: string, id: string): Promise<CollectionView> {
    const collection = await this.repo.findById(id, userId);
    if (!collection) {
      throw new CollectionNotFoundError();
    }
    return collection;
  }

  private async assertUniqueName(userId: string, name: string, exceptId?: string): Promise<void> {
    const existing = await this.repo.findByName(userId, name, exceptId);
    if (existing) {
      throw new CollectionNameConflictError();
    }
  }

  private async resolveMembers(
    userId: string,
    recipeIds: string[],
  ): Promise<Array<{ userRecipeId: string; sortOrder: number }>> {
    if (recipeIds.length === 0) {
      return [];
    }
    const owned = await this.repo.listUserRecipes(userId, recipeIds);
    const byRecipeId = new Map(owned.map((item) => [item.recipeId, item.id]));
    return recipeIds.map((recipeId, index) => {
      const userRecipeId = byRecipeId.get(recipeId);
      if (!userRecipeId) {
        throw new RecipeNotFoundError({ message: `Recipe ${recipeId} was not found` });
      }
      return { userRecipeId, sortOrder: index };
    });
  }
}
