import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCode,
  isSupportedLocale,
  localeChain,
  matchLocale,
} from '@pantrio/shared';
import { Prisma, TranslationOrigin } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/errors/app-exception';
import { currentLocale } from '../common/i18n/request-locale';
import { PrismaService } from '../prisma/prisma.service';
import {
  ArticleDetailDto,
  ArticleSummaryDto,
  ArticleTranslationBodyDto,
  ArticleTranslationInputDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';
import { recipeCardText, recipeHeaderInclude } from '../recipes/recipe-content';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Text of an article in one locale (requirements 2b.2). Complete = title + body. */
type ArticleText = {
  locale: string;
  title: string;
  summary: string | null;
  body: string;
  origin: TranslationOrigin;
  translatedById: string | null;
};

type ArticleTextRow = {
  sourceLocale: string;
  authorId: string;
  title: string;
  summary: string | null;
  body: string;
  translations?: ArticleText[];
};

const isComplete = (text: ArticleText) =>
  text.title.trim().length > 0 && text.body.trim().length > 0;

/** Translation rows; an article without rows falls back to its legacy columns. */
function articleTexts(row: ArticleTextRow): ArticleText[] {
  const texts: ArticleText[] = (row.translations ?? []).map((t) => ({
    locale: t.locale,
    title: t.title,
    summary: t.summary,
    body: t.body,
    origin: t.origin,
    translatedById: t.translatedById,
  }));
  if (!texts.some((t) => t.locale === row.sourceLocale)) {
    texts.unshift({
      locale: row.sourceLocale,
      title: row.title,
      summary: row.summary,
      body: row.body,
      origin: TranslationOrigin.AUTHOR,
      translatedById: row.authorId,
    });
  }
  return texts;
}

function resolveArticleText(row: ArticleTextRow) {
  const texts = articleTexts(row);
  const complete = texts.filter(isComplete);
  const shown =
    localeChain(currentLocale())
      .map((code) => complete.find((t) => t.locale === code))
      .find(Boolean) ??
    texts.find((t) => t.locale === row.sourceLocale) ??
    texts[0];
  return {
    texts,
    shown,
    sourceLocale: row.sourceLocale,
    displayLocale: shown.locale,
    availableLocales: complete
      .map((t) => t.locale)
      .sort(
        (a, b) =>
          Number(b === row.sourceLocale) - Number(a === row.sourceLocale),
      ),
  };
}

function textFromInput(
  input: ArticleTranslationInputDto,
  origin: TranslationOrigin,
  translatedById: string,
): ArticleText {
  const locale = matchLocale(input.locale);
  if (!locale) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LOCALE_NOT_SUPPORTED,
      `Locale '${input.locale}' is not supported`,
      { locale: input.locale },
    );
  }
  const text: ArticleText = {
    locale,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    body: input.body,
    origin,
    translatedById,
  };
  if (!isComplete(text)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.TRANSLATION_INCOMPLETE,
      `Translation '${locale}' needs a title and a body`,
      { locale, steps: 0 },
    );
  }
  return text;
}

const translationsInclude = { translations: true } as const;

const articleInclude = {
  translations: true,
  author: { select: { id: true, displayName: true } },
  recipes: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      recipe: { include: recipeHeaderInclude },
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
        ...translationsInclude,
        author: { select: { id: true, displayName: true } },
        _count: { select: { recipes: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    // Articles readable in the reader's locale first (requirements 2b.2 #6).
    const locale = currentLocale();
    return rows
      .map((row) => this.toSummary(row))
      .map((row, index) => ({ row, index }))
      .sort(
        (a, b) =>
          Number(b.row.availableLocales?.includes(locale)) -
            Number(a.row.availableLocales?.includes(locale)) ||
          a.index - b.index,
      )
      .map((entry) => entry.row);
  }

  async listMine(authorId: string): Promise<ArticleSummaryDto[]> {
    const rows = await this.prisma.article.findMany({
      where: { authorId },
      include: {
        ...translationsInclude,
        author: { select: { id: true, displayName: true } },
        _count: { select: { recipes: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async findBySlug(slug: string, viewer?: AuthUser): Promise<ArticleDetailDto> {
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
    return this.toDetail(row, isAuthor || this.canModerate(viewer));
  }

  async findMineById(id: string, userId: string): Promise<ArticleDetailDto> {
    const row = await this.prisma.article.findUnique({
      where: { id },
      include: articleInclude,
    });
    if (!row || row.authorId !== userId) {
      throw new NotFoundException(`Article '${id}' not found`);
    }
    return this.toDetail(row, true);
  }

  async create(
    user: AuthUser,
    dto: CreateArticleDto,
  ): Promise<ArticleDetailDto> {
    const recipeIds = dto.recipeIds ?? [];
    await this.assertRecipesExist(recipeIds);

    const slug = await this.uniqueSlug(dto.title);
    const sourceLocale =
      dto.sourceLocale && isSupportedLocale(dto.sourceLocale)
        ? dto.sourceLocale
        : currentLocale();
    const texts = this.mergeTexts([], sourceLocale, dto, user.id);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          authorId: user.id,
          title: dto.title.trim(),
          slug,
          summary: dto.summary?.trim() || null,
          body: dto.body,
          coverUrl: dto.coverUrl?.trim() || null,
          publishedAt: dto.publish ? new Date() : null,
          sourceLocale,
          recipes: {
            create: recipeIds.map((recipeId, index) => ({
              recipeId,
              sortOrder: index,
            })),
          },
        },
      });
      await this.writeTexts(tx, created.id, sourceLocale, texts);
      return tx.article.findUniqueOrThrow({
        where: { id: created.id },
        include: articleInclude,
      });
    });
    return this.toDetail(row, true);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpdateArticleDto,
  ): Promise<ArticleDetailDto> {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      include: translationsInclude,
    });
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }
    if (existing.authorId !== user.id) {
      throw new ForbiddenException('Not the article author');
    }
    const sourceLocale =
      dto.sourceLocale && isSupportedLocale(dto.sourceLocale)
        ? dto.sourceLocale
        : existing.sourceLocale;
    const texts = this.mergeTexts(
      articleTexts(existing),
      sourceLocale,
      dto,
      user.id,
    );

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

      await tx.article.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { slug: nextSlug } : {}),
          ...(dto.coverUrl !== undefined
            ? { coverUrl: dto.coverUrl?.trim() || null }
            : {}),
          publishedAt,
        },
      });
      await this.writeTexts(tx, id, sourceLocale, texts);
      return tx.article.findUniqueOrThrow({
        where: { id },
        include: articleInclude,
      });
    });

    return this.toDetail(row, true);
  }

  /**
   * Moderator adds or fixes a translation directly — articles have no review
   * flow yet (requirements 2b.3 #4).
   */
  async upsertTranslationAsModerator(
    id: string,
    locale: string,
    dto: ArticleTranslationBodyDto,
    actor: AuthUser,
  ): Promise<ArticleDetailDto> {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      include: translationsInclude,
    });
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }
    const text = textFromInput(
      { ...dto, locale },
      TranslationOrigin.MODERATOR,
      actor.id,
    );
    if (text.locale === existing.sourceLocale) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.TRANSLATION_IS_SOURCE,
        `'${text.locale}' is the source locale of this article`,
        { locale: text.locale },
      );
    }
    const texts = [
      ...articleTexts(existing).filter((t) => t.locale !== text.locale),
      text,
    ];
    const row = await this.prisma.$transaction(async (tx) => {
      await this.writeTexts(tx, id, existing.sourceLocale, texts);
      return tx.article.findUniqueOrThrow({
        where: { id },
        include: articleInclude,
      });
    });
    return this.toDetail(row, true);
  }

  /** Published articles without a `locale` translation (2b.3 #3). */
  async listMissingTranslations(locale: string): Promise<ArticleSummaryDto[]> {
    if (!isSupportedLocale(locale)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LOCALE_NOT_SUPPORTED,
        `Locale '${locale}' is not supported`,
        { locale },
      );
    }
    const rows = await this.prisma.article.findMany({
      where: { publishedAt: { not: null } },
      include: {
        ...translationsInclude,
        author: { select: { id: true, displayName: true } },
        _count: { select: { recipes: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
    return rows
      .map((row) => this.toSummary(row))
      .filter((row) => !row.availableLocales?.includes(locale));
  }

  private mergeTexts(
    base: ArticleText[],
    sourceLocale: string,
    dto: Partial<CreateArticleDto>,
    actorId: string,
  ): ArticleText[] {
    const previous = new Map(base.map((t) => [t.locale, t]));
    const baseSource = previous.get(sourceLocale);
    const title = dto.title?.trim() || baseSource?.title;
    const body = dto.body ?? baseSource?.body;
    if (!title || !body) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.TRANSLATION_INCOMPLETE,
        `Source locale '${sourceLocale}' needs a title and a body`,
        { locale: sourceLocale, steps: 0 },
      );
    }
    const keepIfSame = (next: ArticleText): ArticleText => {
      const before = previous.get(next.locale);
      return before &&
        before.title === next.title &&
        (before.summary ?? null) === (next.summary ?? null) &&
        before.body === next.body
        ? {
            ...next,
            origin: before.origin,
            translatedById: before.translatedById,
          }
        : next;
    };
    const source = keepIfSame({
      locale: sourceLocale,
      title,
      summary:
        dto.summary !== undefined
          ? dto.summary?.trim() || null
          : (baseSource?.summary ?? null),
      body,
      origin: TranslationOrigin.AUTHOR,
      translatedById: actorId,
    });
    if (!dto.translations) {
      return [source, ...base.filter((t) => t.locale !== sourceLocale)];
    }
    const others = new Map<string, ArticleText>();
    for (const input of dto.translations) {
      const text = textFromInput(input, TranslationOrigin.AUTHOR, actorId);
      if (text.locale === sourceLocale) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.TRANSLATION_IS_SOURCE,
          `'${text.locale}' is the source locale; send it as the main fields`,
          { locale: text.locale },
        );
      }
      if (!others.has(text.locale)) others.set(text.locale, keepIfSame(text));
    }
    return [source, ...others.values()];
  }

  /** Replace translation rows and mirror the source text into the legacy columns. */
  private async writeTexts(
    tx: Prisma.TransactionClient,
    articleId: string,
    sourceLocale: string,
    texts: ArticleText[],
  ) {
    await tx.articleTranslation.deleteMany({ where: { articleId } });
    await tx.articleTranslation.createMany({
      data: texts.map((t) => ({ articleId, ...t })),
    });
    const source = texts.find((t) => t.locale === sourceLocale);
    if (source) {
      await tx.article.update({
        where: { id: articleId },
        data: {
          sourceLocale,
          title: source.title,
          summary: source.summary,
          body: source.body,
        },
      });
    }
  }

  private canModerate(viewer?: AuthUser) {
    const permissions = viewer?.permissions ?? [];
    return (
      permissions.includes('moderation:manage') ||
      permissions.includes('system:manage')
    );
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
    body: string;
    coverUrl: string | null;
    publishedAt: Date | null;
    authorId: string;
    createdAt: Date;
    sourceLocale: string;
    translations?: ArticleText[];
    author: { id: string; displayName: string };
    _count?: { recipes: number };
  }): ArticleSummaryDto {
    const text = resolveArticleText(row);
    return {
      id: row.id,
      title: text.shown.title,
      slug: row.slug,
      summary: text.shown.summary,
      sourceLocale: text.sourceLocale,
      displayLocale: text.displayLocale,
      availableLocales: text.availableLocales,
      coverUrl: row.coverUrl,
      publishedAt: row.publishedAt,
      authorId: row.authorId,
      authorName: row.author.displayName,
      createdAt: row.createdAt,
      recipeCount: row._count?.recipes,
    };
  }

  private toDetail(
    row: {
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
      sourceLocale: string;
      translations: ArticleText[];
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
    },
    includeTranslations = false,
  ): ArticleDetailDto {
    const text = resolveArticleText(row);
    return {
      ...this.toSummary({
        ...row,
        _count: { recipes: row.recipes.length },
      }),
      body: text.shown.body,
      updatedAt: row.updatedAt,
      ...(includeTranslations
        ? {
            translations: text.texts.map((t) => ({
              locale: t.locale,
              title: t.title,
              summary: t.summary,
              body: t.body,
              origin: t.origin,
              translatedById: t.translatedById,
            })),
          }
        : {}),
      recipes: row.recipes.map((link) => ({
        id: link.recipe.id,
        ...recipeCardText(link.recipe),
        slug: link.recipe.slug,
        servings: link.recipe.servings,
        prepTimeMin: link.recipe.prepTimeMin,
        cookTimeMin: link.recipe.cookTimeMin,
        difficulty: link.recipe.difficulty,
        imageUrl: link.recipe.imageUrl,
      })),
    };
  }
}
