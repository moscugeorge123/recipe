import type { RecipeListRecord } from '../../recipes/repository/recipe.repository.js';

export type CollectionCoverPreviewRecord = {
  recipeId: string;
  title: string;
  thumbnailUrl: string | null;
};

export type CollectionMemberRecord = RecipeListRecord & {
  sortOrder: number;
};

export type CollectionRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  recipeCount: number;
  recipeIds: string[];
  coverPreviews: CollectionCoverPreviewRecord[];
};

export type CollectionDetailRecord = CollectionRecord & {
  recipes: CollectionMemberRecord[];
};

export interface CreateCollectionInput {
  userId: string;
  name: string;
  description?: string | null;
  members?: Array<{ userRecipeId: string; sortOrder: number }>;
}

export interface ICollectionRepository {
  list(params: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: CollectionRecord[]; total: number }>;
  findById(id: string, userId: string): Promise<CollectionDetailRecord | null>;
  findByName(userId: string, name: string, exceptId?: string): Promise<CollectionRecord | null>;
  create(input: CreateCollectionInput): Promise<CollectionDetailRecord>;
  update(
    id: string,
    userId: string,
    input: { name?: string; description?: string | null },
  ): Promise<CollectionDetailRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  addMember(
    collectionId: string,
    userId: string,
    userRecipeId: string,
    sortOrder: number,
  ): Promise<CollectionDetailRecord | null>;
  removeMember(
    collectionId: string,
    userId: string,
    userRecipeId: string,
  ): Promise<CollectionDetailRecord | null>;
  reorderMembers(
    collectionId: string,
    userId: string,
    userRecipeIds: string[],
  ): Promise<CollectionDetailRecord | null>;
  findUserRecipe(
    userId: string,
    recipeId: string,
  ): Promise<{ id: string; recipeId: string } | null>;
  listUserRecipes(
    userId: string,
    recipeIds: string[],
  ): Promise<Array<{ id: string; recipeId: string }>>;
  maxSortOrder(collectionId: string): Promise<number>;
}
