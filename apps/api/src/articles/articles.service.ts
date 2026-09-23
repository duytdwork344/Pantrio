import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  ArticleDetailDto,
  ArticleSummaryDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const articleInclude = {
  author: { select: { id: true, displayName: true } },
  recipes: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      recipe: true,
    },
  },
};

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(): Promise<ArticleSummaryDto[]> {
    const rows = await this.prisma.article.findMany({
      where: { publishedAt: { not: null } },
      include: {
        author: { select: { id: true, displayName: true } },
        _count: { select: { recipes: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async listMine(authorId: string): Promise<ArticleSummaryDto[]> {
    const rows = await this.prisma.article.findMany({
      where: { authorId },
      include: {
        author: { select: { id: true, displayName: true } },
        _count: { select: { recipes: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async findBySlug(
    slug: string,
    viewer?: AuthUser,
  ): Promise<ArticleDetailDto> {
    const row = await this.prisma.article.findUnique({
      where: { slug },
      include: articleInclude,
    });
    if (!row) {
      throw new NotFoundException(`Article '${slug}' not found`);
    }
    const isAuthor = viewer?.id === row.authorId;
    if (!row.publishedAt && !isAuthor) {
      throw new NotFoundException(`Article '${slug}' not found`);
    }
    return this.toDetail(row);
  }

  async findMineById(id: string, userId: string): Promise<ArticleDetailDto> {
    const row = await this.prisma.article.findUnique({
      where: { id },
      include: articleInclude,
    });
    if (!row || row.authorId !== userId) {
      throw new NotFoundException(`Article '${id}' not found`);
    }
    return this.toDetail(row);
  }

  async create(user: AuthUser, dto: CreateArticleDto): Promise<ArticleDetailDto> {
    const recipeIds = dto.recipeIds ?? [];
    await this.assertRecipesExist(recipeIds);

    const slug = await this.uniqueSlug(dto.title);
    const row = await this.prisma.article.create({
      data: {
        authorId: user.id,
        title: dto.title.trim(),
        slug,
        summary: dto.summary?.trim() || null,
        body: dto.body,
        coverUrl: dto.coverUrl?.trim() || null,
        publishedAt: dto.publish ? new Date() : null,
        recipes: {
          create: recipeIds.map((recipeId, index) => ({
            recipeId,
            sortOrder: index,
          })),
        },
      },
      include: articleInclude,
    });
    return this.toDetail(row);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpdateArticleDto,
  ): Promise<ArticleDetailDto> {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }
    if (existing.authorId !== user.id) {
      throw new ForbiddenException('Not the article author');
    }

    if (dto.recipeIds !== undefined) {
      await this.assertRecipesExist(dto.recipeIds);
    }

    let nextSlug = existing.slug;
    if (dto.title && dto.title.trim() !== existing.title) {
      nextSlug = await this.uniqueSlug(dto.title, id);
    }

    let publishedAt = existing.publishedAt;
    if (dto.publish === true) {
      publishedAt = existing.publishedAt ?? new Date();
    } else if (dto.publish === false) {
      publishedAt = null;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.recipeIds !== undefined) {
        await tx.articleRecipe.deleteMany({ where: { articleId: id } });
        if (dto.recipeIds.length) {
          await tx.articleRecipe.createMany({
            data: dto.recipeIds.map((recipeId, index) => ({
              articleId: id,
              recipeId,
              sortOrder: index,
            })),
          });
        }
      }

      return tx.article.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.title !== undefined ? { slug: nextSlug } : {}),
          ...(dto.summary !== undefined
            ? { summary: dto.summary?.trim() || null }
            : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
          ...(dto.coverUrl !== undefined
            ? { coverUrl: dto.coverUrl?.trim() || null }
            : {}),
          publishedAt,
        },
        include: articleInclude,
      });
    });

    return this.toDetail(row);
  }

  private async assertRecipesExist(recipeIds: string[]) {
    if (!recipeIds.length) {
      return;
    }
    const found = await this.prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        visibility: { not: 'GROUP' },
        groupId: null,
      },
      select: { id: true },
    });
    if (found.length !== recipeIds.length) {
      throw new BadRequestException(
        'One or more recipeIds were not found or are group cookbook recipes',
      );
    }
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title) || 'article';
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const clash = await this.prisma.article.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash || clash.id === excludeId) {
        return candidate;
      }
    }
    throw new ConflictException('Could not allocate a unique article slug');
  }

  private toSummary(row: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    coverUrl: string | null;
    publishedAt: Date | null;
    authorId: string;
    createdAt: Date;
    author: { id: string; displayName: string };
    _count?: { recipes: number };
  }): ArticleSummaryDto {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      coverUrl: row.coverUrl,
      publishedAt: row.publishedAt,
      authorId: row.authorId,
      authorName: row.author.displayName,
      createdAt: row.createdAt,
      recipeCount: row._count?.recipes,
    };
  }

  private toDetail(row: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    coverUrl: string | null;
    publishedAt: Date | null;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    body: string;
    author: { id: string; displayName: string };
    recipes: Array<{
      sortOrder: number;
      recipe: {
        id: string;
        title: string;
        slug: string;
        description: string | null;
        servings: number;
        prepTimeMin: number | null;
        cookTimeMin: number | null;
        difficulty: import('@prisma/client').RecipeDifficulty;
        imageUrl: string | null;
      };
    }>;
  }): ArticleDetailDto {
    return {
      ...this.toSummary({
        ...row,
        _count: { recipes: row.recipes.length },
      }),
      body: row.body,
      updatedAt: row.updatedAt,
      recipes: row.recipes.map((link) => ({
        id: link.recipe.id,
        title: link.recipe.title,
        slug: link.recipe.slug,
        description: link.recipe.description,
        servings: link.recipe.servings,
        prepTimeMin: link.recipe.prepTimeMin,
        cookTimeMin: link.recipe.cookTimeMin,
        difficulty: link.recipe.difficulty,
        imageUrl: link.recipe.imageUrl,
      })),
    };
  }
}
