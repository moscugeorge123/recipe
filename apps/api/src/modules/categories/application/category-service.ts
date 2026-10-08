import type { PrismaClient } from '@prisma/client';

import { ConflictError, ValidationError } from '../../../shared/errors/app-error.js';
import { CategoryNotFoundError } from '../../../shared/errors/recipe-errors.js';

const DEFAULT_SLUGS = new Set(['breakfast', 'lunch', 'dinner', 'sweet']);

export interface CategoryView {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  recipeCount: number;
  isDefault: boolean;
}

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export class CategoryService {
  constructor(private readonly db: PrismaClient) {}

  async list(userId: string): Promise<CategoryView[]> {
    const categories = await this.db.category.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { recipes: true } } },
    });
    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
      recipeCount: category._count.recipes,
      isDefault: DEFAULT_SLUGS.has(category.slug),
    }));
  }

  async create(userId: string, name: string): Promise<CategoryView> {
    const slug = slugify(name);
    if (!slug)
      throw new ValidationError({ message: 'Category name must contain letters or numbers' });
    const existing = await this.db.category.findUnique({
      where: { userId_slug: { userId, slug } },
    });
    if (existing) throw new ConflictError({ message: 'A category with this name already exists' });
    const count = await this.db.category.count({ where: { userId } });
    const category = await this.db.category.create({
      data: { userId, name: name.trim(), slug, sortOrder: count },
    });
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
      recipeCount: 0,
      isDefault: false,
    };
  }

  async rename(userId: string, categoryId: string, name: string): Promise<CategoryView> {
    const category = await this.db.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new CategoryNotFoundError();
    const updated = await this.db.category.update({
      where: { id: category.id },
      data: { name: name.trim() },
      include: { _count: { select: { recipes: true } } },
    });
    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      sortOrder: updated.sortOrder,
      recipeCount: updated._count.recipes,
      isDefault: DEFAULT_SLUGS.has(updated.slug),
    };
  }

  async delete(userId: string, categoryId: string): Promise<void> {
    const category = await this.db.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new CategoryNotFoundError();
    if (DEFAULT_SLUGS.has(category.slug)) {
      throw new ValidationError({
        message: 'Default categories can be renamed but not deleted',
      });
    }
    await this.db.category.delete({ where: { id: category.id } });
  }
}
