import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, isSupportedLocale } from '@pantrio/shared';
import {
  ContentEventType,
  FoodVisibility,
  GroupMemberRole,
  Prisma,
  RecipeDifficulty,
  RecipeModerationStatus,
  RecipeVisibility,
  TranslationOrigin,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/errors/app-exception';
import { assertFoodsUsable as ensureFoodsUsable } from '../common/foods/assert-food-usable';
import { pickTranslation } from '../common/i18n/locale';
import { currentLocale } from '../common/i18n/request-locale';
import { GroupsService } from '../groups/groups.service';
import { aggregateRecipeNutrition } from '../common/nutrition/aggregate';
import { CatalogService } from '../catalog/catalog.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import {
  CreateGroupRecipeDto,
  CreateRecipeDto,
  RecipeDetailDto,
  RecipeTranslationBodyDto,
  RecipeIngredientInputDto,
  RecipeStepInputDto,
  ReviewFoodDecisionDto,
  ReviewRecipeDto,
  RecipeSummaryDto,
  ShareChannel,
  ShareRecipeResultDto,
  UpdateGroupRecipeDto,
  UpdateRecipeDto,
} from './dto/recipe.dto';
import {
  alignSteps,
  availableLocales,
  isComplete,
  localizedHeader,
  mergeTexts,
  recipeHeaderInclude,
  remapNotes,
  resolveText,
  textFromInput,
  textsFromRevision,
  textsFromRows,
  textsToJson,
  writeTexts,
  type RecipeText,
  type RecipeTextInput,
} from './recipe-content';

function collapseIngredients(
  items: RecipeIngredientInputDto[],
): RecipeIngredientInputDto[] {
  const collapsed: RecipeIngredientInputDto[] = [];
  for (const item of items) {
    const previous = collapsed.find((entry) => entry.foodId === item.foodId);
    if (!previous) {
      collapsed.push({ ...item });
      continue;
    }
    if (previous.unit !== item.unit) {
      throw new BadRequestException(
        `Merged food '${item.foodId}' would mix units ${previous.unit} and ${item.unit}`,
      );
    }
    previous.quantity += item.quantity;
    previous.optional = Boolean(previous.optional && item.optional);
  }
  return collapsed.map((item, index) => ({ ...item, sortOrder: index }));
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: {
    translations: true;
    ingredients: {
      include: {
        translations: true;
        food: {
          include: {
            translations: true;
            nutrients: {
              include: { nutrient: { include: { translations: true } } };
            };
          };
        };
      };
    };
    steps: { include: { translations: true } };
  };
}>;

/** Fields of a write request that carry source-locale text and translations. */
type TextWrite = {
  title?: string;
  description?: string | null;
  sourceLocale?: string;
  translations?: RecipeTextInput[];
  ingredients?: Array<{ foodId: string; note?: string | null }>;
};

type DetailMeta = {
  contentVersion?: number | null;
  moderationStatus?: RecipeModerationStatus | null;
  publishedVersion?: number | null;
  /** Texts of a revision overlay; default: the recipe's translation rows. */
  texts?: RecipeText[];
  /** Return every locale's text (editors only). */
  includeTranslations?: boolean;
};

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly catalog: CatalogService,
    private readonly search: SearchService,
    private readonly nutrition: NutritionService,
  ) {}

  /**
   * Discover catalog. Recipes available in the reader's locale come first
   * (requirements 2b.2 #6); `onlyMyLocale` hides the others.
   */
  async list(
    options: { onlyMyLocale?: boolean } = {},
  ): Promise<RecipeSummaryDto[]> {
    const locale = currentLocale();
    const recipes = await this.prisma.recipe.findMany({
      where: {
        visibility: RecipeVisibility.PUBLIC,
        groupId: null,
        publishedVersion: { not: null },
        ...(options.onlyMyLocale ? { translations: { some: { locale } } } : {}),
      },
      include: recipeHeaderInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const summaries = recipes.map((recipe) => this.toSummary(recipe));
    const inLocale = (row: RecipeSummaryDto) =>
      Number(row.availableLocales?.includes(locale) ?? false);
    const ranked = summaries
      .map((row, index) => ({ row, index }))
      .sort((a, b) => inLocale(b.row) - inLocale(a.row) || a.index - b.index)
      .map((entry) => entry.row);
    return options.onlyMyLocale
      ? ranked.filter((row) => inLocale(row))
      : ranked;
  }

  /** Catalog recipes authored by the user (excludes group cookbook). */
  async listMine(userId: string): Promise<RecipeSummaryDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { authorId: userId, groupId: null },
      include: {
        ...recipeHeaderInclude,
        revisions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return recipes.map((recipe) => {
      const latest = recipe.revisions[0];
      const showingDraft =
        latest != null && latest.version !== recipe.publishedVersion;
      const draftHeader = showingDraft
        ? this.revisionHeader(latest, recipe.authorId)
        : null;
      return {
        ...this.toSummary(recipe),
        ...(draftHeader ? draftHeader : {}),
        ...(showingDraft
          ? {
              servings: latest.servings,
              prepTimeMin: latest.prepTimeMin,
              cookTimeMin: latest.cookTimeMin,
              difficulty: latest.difficulty,
              imageUrl: latest.imageUrl,
              videoUrl: latest.videoUrl,
            }
          : {}),
        contentVersion: latest?.version ?? recipe.publishedVersion ?? null,
        moderationStatus: latest?.moderationStatus ?? null,
        publishedVersion: recipe.publishedVersion,
      };
    });
  }

  async listGroupCookbook(userId: string): Promise<RecipeSummaryDto[]> {
    const membership = await this.groups.requireMembership(userId);
    const recipes = await this.prisma.recipe.findMany({
      where: {
        groupId: membership.groupId,
        visibility: RecipeVisibility.GROUP,
      },
      include: recipeHeaderInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return recipes.map((recipe) => this.toSummary(recipe));
  }

  async findBySlug(
    slug: string,
    viewer?: AuthUser,
    groupId?: string,
  ): Promise<RecipeDetailDto | null> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { slug },
      include: this.detailInclude(),
    });

    if (!recipe) {
      return null;
    }

    const viewerUserId = viewer?.id;

    if (recipe.visibility === RecipeVisibility.GROUP || recipe.groupId) {
      if (!viewerUserId || !recipe.groupId) {
        return null;
      }
      await this.groups.requireMembership(viewerUserId, recipe.groupId);
      return this.toDetail(recipe, viewerUserId, groupId ?? recipe.groupId, {
        includeTranslations: true,
      });
    }

    const latest = await this.latestRevision(recipe.id);
    const draftIsNewer =
      latest != null && latest.version !== recipe.publishedVersion;
    const canSeeDraft =
      draftIsNewer &&
      viewer != null &&
      (viewer.id === recipe.authorId || this.canModerate(viewer));

    if (recipe.publishedVersion == null && !canSeeDraft) {
      return null;
    }

    const canEdit =
      viewer != null &&
      (viewer.id === recipe.authorId || this.canModerate(viewer));

    if (canSeeDraft && latest) {
      return this.toDetailFromRevision(
        recipe,
        latest,
        viewerUserId,
        groupId,
        canEdit,
      );
    }

    return this.toDetail(recipe, viewerUserId, groupId, {
      includeTranslations: canEdit,
    });
  }

  async findGroupBySlug(
    userId: string,
    slug: string,
  ): Promise<RecipeDetailDto | null> {
    const membership = await this.groups.requireMembership(userId);
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        slug,
        groupId: membership.groupId,
        visibility: RecipeVisibility.GROUP,
      },
      include: this.detailInclude(),
    });
    if (!recipe) {
      return null;
    }
    return this.toDetail(recipe, userId, membership.groupId, {
      includeTranslations: true,
    });
  }

  async saveRecipe(userId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true },
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe '${recipeId}' not found`);
    }

    await this.prisma.savedRecipe.upsert({
      where: {
        userId_recipeId: { userId, recipeId },
      },
      update: {},
      create: { userId, recipeId },
    });

    return { saved: true, recipeId };
  }

  async unsaveRecipe(userId: string, recipeId: string) {
    await this.prisma.savedRecipe.deleteMany({
      where: { userId, recipeId },
    });
    return { saved: false, recipeId };
  }

  /**
   * Intent share: always records user intent (+1), optional channel.
   * Logged-in users are soft rate-limited (30s per recipe) so spam does not inflate counts.
   */
  async recordShare(
    recipeId: string,
    channel: ShareChannel | undefined,
    userId?: string,
  ): Promise<ShareRecipeResultDto> {
    const resolvedChannel: ShareChannel = channel ?? 'unknown';
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, shareCount: true },
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe '${recipeId}' not found`);
    }

    if (userId) {
      const since = new Date(Date.now() - 30_000);
      const recent = await this.prisma.contentEvent.findFirst({
        where: {
          type: ContentEventType.SHARE,
          recipeId,
          userId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (recent) {
        return {
          recipeId,
          shareCount: recipe.shareCount,
          channel: resolvedChannel,
          rateLimited: true,
        };
      }
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.contentEvent.create({
        data: {
          type: ContentEventType.SHARE,
          recipeId,
          userId: userId ?? null,
          channel: resolvedChannel,
        },
      }),
      this.prisma.recipe.update({
        where: { id: recipeId },
        data: { shareCount: { increment: 1 } },
        select: { id: true, shareCount: true },
      }),
    ]);

    return {
      recipeId: updated.id,
      shareCount: updated.shareCount,
      channel: resolvedChannel,
    };
  }

  async listSavedRecipes(userId: string) {
    const rows = await this.prisma.savedRecipe.findMany({
      where: { userId },
      include: { recipe: { include: recipeHeaderInclude } },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      recipeId: row.recipeId,
      savedAt: row.createdAt,
      recipe: this.toSummary(row.recipe),
    }));
  }

  async create(
    author: AuthUser,
    dto: CreateRecipeDto,
  ): Promise<RecipeDetailDto> {
    if (dto.visibility === RecipeVisibility.GROUP) {
      throw new BadRequestException(
        'Use POST /groups/me/recipes to create group cookbook recipes',
      );
    }

    const visibility = dto.visibility ?? RecipeVisibility.PUBLIC;
    const slug = dto.slug?.trim()
      ? await this.resolveUniqueSlug(dto.slug, { allowSuffix: false })
      : await this.resolveUniqueSlug(dto.title, { allowSuffix: true });
    await this.assertFoodsUsable(dto.ingredients, author);
    const resolvedSteps = this.resolveStepsInput(dto.steps, dto.instructions);
    const { sourceLocale, texts } = this.buildTexts({
      base: [],
      currentSource: currentLocale(),
      dto,
      steps: resolvedSteps,
      ingredients: dto.ingredients,
      actorId: author.id,
    });

    const recipe = await this.createWithTexts(sourceLocale, texts, {
      authorId: author.id,
      groupId: null,
      title: dto.title.trim(),
      slug,
      description: dto.description?.trim() || null,
      servings: dto.servings ?? 2,
      prepTimeMin: dto.prepTimeMin ?? null,
      cookTimeMin: dto.cookTimeMin ?? null,
      difficulty: dto.difficulty ?? RecipeDifficulty.EASY,
      instructions: this.deriveInstructions(resolvedSteps),
      imageUrl: dto.imageUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      visibility,
      ingredients: {
        create: this.mapIngredientCreates(dto.ingredients),
      },
      steps: {
        create: this.mapStepCreates(resolvedSteps),
      },
    });

    await this.prisma.recipeRevision.create({
      data: this.revisionData(recipe, 1, RecipeModerationStatus.PENDING, texts),
    });

    return this.toDetail(recipe, author.id, undefined, {
      contentVersion: 1,
      moderationStatus: RecipeModerationStatus.PENDING,
      publishedVersion: null,
      includeTranslations: true,
    });
  }

  async createForGroup(
    author: AuthUser,
    dto: CreateGroupRecipeDto,
  ): Promise<RecipeDetailDto> {
    const membership = await this.groups.requireMembership(author.id);
    const slug = dto.slug?.trim()
      ? await this.resolveUniqueSlug(dto.slug, { allowSuffix: false })
      : await this.resolveUniqueSlug(dto.title, { allowSuffix: true });
    await this.assertFoodsUsable(dto.ingredients, author);
    const resolvedSteps = this.resolveStepsInput(dto.steps, dto.instructions);
    const { sourceLocale, texts } = this.buildTexts({
      base: [],
      currentSource: currentLocale(),
      dto,
      steps: resolvedSteps,
      ingredients: dto.ingredients,
      actorId: author.id,
    });

    const recipe = await this.createWithTexts(sourceLocale, texts, {
      authorId: author.id,
      groupId: membership.groupId,
      title: dto.title.trim(),
      slug,
      description: dto.description?.trim() || null,
      servings: dto.servings ?? 2,
      prepTimeMin: dto.prepTimeMin ?? null,
      cookTimeMin: dto.cookTimeMin ?? null,
      difficulty: dto.difficulty ?? RecipeDifficulty.EASY,
      instructions: this.deriveInstructions(resolvedSteps),
      imageUrl: dto.imageUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      visibility: RecipeVisibility.GROUP,
      ingredients: {
        create: this.mapIngredientCreates(dto.ingredients),
      },
      steps: {
        create: this.mapStepCreates(resolvedSteps),
      },
    });

    return this.toDetail(recipe, author.id, membership.groupId, {
      includeTranslations: true,
    });
  }

  async update(
    id: string,
    actor: AuthUser,
    dto: UpdateRecipeDto,
  ): Promise<RecipeDetailDto> {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Recipe '${id}' not found`);
    }

    if (existing.groupId || existing.visibility === RecipeVisibility.GROUP) {
      throw new BadRequestException(
        'Use PATCH /groups/me/recipes/:id for group cookbook recipes',
      );
    }

    this.assertCanEditCatalog(existing.authorId, actor);

    if (dto.visibility === RecipeVisibility.GROUP) {
      throw new BadRequestException(
        'Cannot set visibility GROUP on a catalog recipe',
      );
    }

    if (dto.ingredients?.length) {
      await this.assertFoodsUsable(dto.ingredients, actor);
    }

    const revision = await this.submitCatalogRevision(id, dto, actor);
    const recipe = await this.prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: this.detailInclude(),
    });
    return this.toDetailFromRevision(
      recipe,
      revision,
      actor.id,
      undefined,
      true,
    );
  }

  async updateForGroup(
    id: string,
    actor: AuthUser,
    dto: UpdateGroupRecipeDto,
  ): Promise<RecipeDetailDto> {
    const existing = await this.prisma.recipe.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!existing || !existing.groupId) {
      throw new NotFoundException(`Group recipe '${id}' not found`);
    }

    const membership = await this.groups.requireMembership(
      actor.id,
      existing.groupId,
    );
    this.assertCanEditGroup(existing.authorId, membership.role, actor);

    if (dto.ingredients?.length) {
      await this.assertFoodsUsable(dto.ingredients, actor);
    }

    const recipe = await this.applyRecipePatch(existing, actor, {
      ...dto,
      // Keep GROUP invariant
      visibility: RecipeVisibility.GROUP,
    });
    return this.toDetail(recipe, actor.id, existing.groupId, {
      includeTranslations: true,
    });
  }

  async deleteForGroup(
    id: string,
    actor: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing || !existing.groupId) {
      throw new NotFoundException(`Group recipe '${id}' not found`);
    }

    const membership = await this.groups.requireMembership(
      actor.id,
      existing.groupId,
    );
    this.assertCanEditGroup(existing.authorId, membership.role, actor);

    await this.prisma.recipe.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Direct write (group cookbook — no revision). */
  private async applyRecipePatch(
    existing: RecipeWithIngredients,
    actor: AuthUser,
    dto:
      | UpdateRecipeDto
      | (UpdateGroupRecipeDto & { visibility?: RecipeVisibility }),
  ) {
    const id = existing.id;
    const existingTitle = existing.title;
    let slug = existing.slug;
    if (dto.slug?.trim()) {
      slug = await this.resolveUniqueSlug(dto.slug, {
        excludeRecipeId: id,
        allowSuffix: false,
      });
    } else if (dto.title?.trim() && dto.title.trim() !== existingTitle) {
      slug = await this.resolveUniqueSlug(dto.title, {
        excludeRecipeId: id,
        allowSuffix: true,
      });
    }

    const shouldReplaceSteps =
      dto.steps !== undefined || dto.instructions !== undefined;
    const resolvedSteps = shouldReplaceSteps
      ? this.resolveStepsInput(dto.steps, dto.instructions)
      : null;
    const { sourceLocale, texts } = this.buildTexts({
      base: textsFromRows(existing),
      currentSource: existing.sourceLocale,
      dto,
      steps: resolvedSteps ?? existing.steps,
      stepsReplaced: resolvedSteps != null,
      ingredients: dto.ingredients ?? existing.ingredients,
      ingredientsReplaced: dto.ingredients != null,
      actorId: actor.id,
    });

    return this.prisma.$transaction(async (tx) => {
      if (dto.ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      }
      if (resolvedSteps) {
        await tx.recipeStep.deleteMany({ where: { recipeId: id } });
      }

      return tx.recipe
        .update({
          where: { id },
          data: {
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            slug,
            ...(dto.description !== undefined
              ? { description: dto.description?.trim() || null }
              : {}),
            ...(dto.servings !== undefined ? { servings: dto.servings } : {}),
            ...(dto.prepTimeMin !== undefined
              ? { prepTimeMin: dto.prepTimeMin }
              : {}),
            ...(dto.cookTimeMin !== undefined
              ? { cookTimeMin: dto.cookTimeMin }
              : {}),
            ...(dto.difficulty !== undefined
              ? { difficulty: dto.difficulty }
              : {}),
            ...(resolvedSteps
              ? { instructions: this.deriveInstructions(resolvedSteps) }
              : dto.instructions !== undefined
                ? { instructions: dto.instructions.trim() }
                : {}),
            ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
            ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl } : {}),
            ...(dto.visibility !== undefined
              ? { visibility: dto.visibility }
              : {}),
            ...(dto.ingredients
              ? {
                  ingredients: {
                    create: this.mapIngredientCreates(dto.ingredients),
                  },
                }
              : {}),
            ...(resolvedSteps
              ? {
                  steps: {
                    create: this.mapStepCreates(resolvedSteps),
                  },
                }
              : {}),
          },
          include: this.detailInclude(),
        })
        .then(async (updated) => {
          await writeTexts(tx, this.textTargets(updated, sourceLocale, texts));
          return tx.recipe.findUniqueOrThrow({
            where: { id },
            include: this.detailInclude(),
          });
        });
    });
  }

  /**
   * Source text from the request's flat fields (title, description, step
   * bodies, ingredient notes) on top of `base`, plus `translations`.
   */
  private buildTexts(params: {
    base: RecipeText[];
    currentSource: string;
    dto: TextWrite;
    steps: Array<{ body: string }>;
    stepsReplaced?: boolean;
    ingredients: Array<{ foodId: string; note?: string | null }>;
    ingredientsReplaced?: boolean;
    actorId: string;
  }): { sourceLocale: string; texts: RecipeText[] } {
    const { base, dto, steps, ingredients } = params;
    const stepsReplaced = params.stepsReplaced ?? true;
    const ingredientsReplaced = params.ingredientsReplaced ?? true;
    const sourceLocale =
      dto.sourceLocale && isSupportedLocale(dto.sourceLocale)
        ? dto.sourceLocale
        : params.currentSource;
    const baseSource = base.find((text) => text.locale === sourceLocale);
    const title = dto.title?.trim() || baseSource?.title;
    if (!title) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.TRANSLATION_INCOMPLETE,
        `Source locale '${sourceLocale}' needs a title`,
        { locale: sourceLocale, steps: steps.length },
      );
    }
    const stepBodies = stepsReplaced
      ? steps.map((step) => step.body)
      : baseSource
        ? alignSteps(baseSource, steps.length).steps
        : steps.map((step) => step.body);
    const notes = ingredientsReplaced
      ? Object.fromEntries(
          ingredients.flatMap((item) =>
            item.note?.trim() ? [[item.foodId, item.note.trim()]] : [],
          ),
        )
      : (baseSource?.notes ?? {});
    const texts = mergeTexts({
      base,
      sourceLocale,
      source: {
        title,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : (baseSource?.description ?? null),
        steps: stepBodies,
        notes,
      },
      translations: dto.translations,
      stepCount: steps.length,
      foodIds: new Set(ingredients.map((item) => item.foodId)),
      actorId: params.actorId,
    });
    return { sourceLocale, texts };
  }

  /** Create a recipe and its translation rows in one transaction. */
  private async createWithTexts(
    sourceLocale: string,
    texts: RecipeText[],
    data: Prisma.RecipeUncheckedCreateInput,
  ): Promise<RecipeWithIngredients> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.recipe.create({
        data: { ...data, sourceLocale },
        include: this.detailInclude(),
      });
      await writeTexts(tx, this.textTargets(created, sourceLocale, texts));
      return tx.recipe.findUniqueOrThrow({
        where: { id: created.id },
        include: this.detailInclude(),
      });
    });
  }

  private textTargets(
    recipe: {
      id: string;
      steps: Array<{ id: string }>;
      ingredients: Array<{ id: string; foodId: string }>;
    },
    sourceLocale: string,
    texts: RecipeText[],
  ) {
    return {
      recipeId: recipe.id,
      sourceLocale,
      texts,
      stepIds: recipe.steps.map((step) => step.id),
      ingredientIdByFood: new Map(
        recipe.ingredients.map((item) => [item.foodId, item.id]),
      ),
    };
  }

  private assertCanEditCatalog(authorId: string, actor: AuthUser) {
    const isAuthor = authorId === actor.id;
    const isElevated =
      actor.permissions.includes('system:manage') ||
      actor.permissions.includes('moderation:manage');

    if (!isAuthor && !isElevated) {
      throw new ForbiddenException('You can only edit your own recipes');
    }
  }

  private assertCanEditGroup(
    authorId: string,
    role: GroupMemberRole,
    actor: AuthUser,
  ) {
    const isAuthor = authorId === actor.id;
    const isOwner = role === GroupMemberRole.OWNER;
    const isElevated =
      actor.permissions.includes('system:manage') ||
      actor.permissions.includes('moderation:manage');

    if (!isAuthor && !isOwner && !isElevated) {
      throw new ForbiddenException(
        'Only the author or group owner can edit this cookbook recipe',
      );
    }
  }

  private async assertFoodsUsable(
    ingredients: RecipeIngredientInputDto[],
    user: AuthUser,
  ) {
    await ensureFoodsUsable(
      this.prisma,
      ingredients.map((item) => item.foodId),
      user,
    );

    const foodIds = ingredients.map((item) => item.foodId);
    if (new Set(foodIds).size !== foodIds.length) {
      throw new BadRequestException('Duplicate foodId in ingredients');
    }
  }

  private mapIngredientCreates(ingredients: RecipeIngredientInputDto[]) {
    return ingredients.map((item, index) => ({
      foodId: item.foodId,
      quantity: item.quantity,
      unit: item.unit.trim(),
      note: item.note?.trim() || null,
      optional: item.optional ?? false,
      sortOrder: item.sortOrder ?? index,
    }));
  }

  /** Prefer explicit steps; else split instructions by non-empty lines. */
  private resolveStepsInput(
    steps: RecipeStepInputDto[] | undefined,
    instructions: string | undefined,
  ): Array<{ body: string; imageUrl: string | null; sortOrder: number }> {
    if (steps?.length) {
      // Normalize to 0..n-1 so step order = array order, which translations follow.
      return steps
        .map((step, index) => ({ step, order: step.sortOrder ?? index, index }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ step }, index) => ({
          body: step.body.trim(),
          imageUrl: step.imageUrl?.trim() || null,
          sortOrder: index,
        }));
    }
    const lines = (instructions ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!lines.length) {
      throw new BadRequestException(
        'Provide steps[] or a non-empty instructions string',
      );
    }
    return lines.map((body, index) => ({
      body,
      imageUrl: null,
      sortOrder: index,
    }));
  }

  private mapStepCreates(
    steps: Array<{ body: string; imageUrl: string | null; sortOrder: number }>,
  ) {
    return steps.map((step) => ({
      body: step.body,
      imageUrl: step.imageUrl,
      sortOrder: step.sortOrder,
    }));
  }

  private deriveInstructions(steps: Array<{ body: string }>): string {
    return steps.map((s) => s.body).join('\n');
  }

  private async resolveUniqueSlug(
    source: string,
    options: { excludeRecipeId?: string; allowSuffix: boolean },
  ): Promise<string> {
    const base = slugify(source);
    if (!base) {
      throw new BadRequestException('Could not derive a valid slug');
    }

    let candidate = base;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.recipe.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === options.excludeRecipeId) {
        return candidate;
      }

      if (!options.allowSuffix) {
        throw new ConflictException(`Slug '${candidate}' already exists`);
      }

      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  private detailInclude() {
    return {
      translations: true,
      ingredients: {
        include: {
          translations: true,
          food: {
            include: {
              translations: true,
              nutrients: {
                include: { nutrient: { include: { translations: true } } },
                orderBy: { nutrient: { sortOrder: 'asc' as const } },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      steps: {
        include: { translations: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    };
  }

  private toSummary(recipe: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    servings: number;
    prepTimeMin: number | null;
    cookTimeMin: number | null;
    difficulty: RecipeDifficulty;
    imageUrl: string | null;
    videoUrl?: string | null;
    shareCount: number;
    sourceLocale: string;
    translations?: Array<{
      locale: string;
      title: string;
      description: string | null;
    }>;
    steps?: Array<{ translations: Array<{ locale: string }> }>;
  }): RecipeSummaryDto {
    const header = localizedHeader(recipe, currentLocale());
    return {
      id: recipe.id,
      title: header.title,
      slug: recipe.slug,
      description: header.description,
      sourceLocale: header.sourceLocale,
      displayLocale: header.displayLocale,
      availableLocales: header.availableLocales,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
      videoUrl: recipe.videoUrl ?? null,
      shareCount: recipe.shareCount,
    };
  }

  private async toDetail(
    recipe: RecipeWithIngredients,
    viewerUserId?: string,
    groupId?: string,
    meta?: DetailMeta,
  ): Promise<RecipeDetailDto> {
    const texts = meta?.texts ?? textsFromRows(recipe);
    const stepCount = recipe.steps.length;
    const { text: shown, displayLocale } = resolveText(
      texts,
      recipe.sourceLocale,
      currentLocale(),
      stepCount,
    );
    const source = texts.find((text) => text.locale === recipe.sourceLocale);
    const stepBody = (index: number, legacy: string) =>
      shown.steps[index]?.trim() || source?.steps[index]?.trim() || legacy;
    const ingredientNote = (foodId: string, legacy: string | null) =>
      shown.notes[foodId] ?? source?.notes[foodId] ?? legacy;

    let inventoryFoodIds = new Set<string>();
    let saved = false;

    if (viewerUserId) {
      const foodIds = recipe.ingredients.map((item) => item.foodId);
      if (groupId) {
        await this.groups.requireMembership(viewerUserId, groupId);
      }
      const pantryWhere = groupId
        ? { groupId, foodId: { in: foodIds } }
        : { userId: viewerUserId, groupId: null, foodId: { in: foodIds } };

      const [inventoryRows, savedRow] = await Promise.all([
        foodIds.length
          ? this.prisma.inventoryItem.findMany({
              where: pantryWhere,
              select: { foodId: true },
              distinct: ['foodId'],
            })
          : Promise.resolve([]),
        this.prisma.savedRecipe.findUnique({
          where: {
            userId_recipeId: {
              userId: viewerUserId,
              recipeId: recipe.id,
            },
          },
          select: { id: true },
        }),
      ]);

      inventoryFoodIds = new Set(inventoryRows.map((row) => row.foodId));
      saved = Boolean(savedRow);
    }

    return {
      ...this.toSummary(recipe),
      title: shown.title,
      description: shown.description,
      sourceLocale: recipe.sourceLocale,
      displayLocale,
      availableLocales: availableLocales(texts, recipe.sourceLocale, stepCount),
      authorId: recipe.authorId,
      groupId: recipe.groupId ?? null,
      visibility: recipe.visibility,
      instructions: recipe.steps
        .map((step, index) => stepBody(index, step.body))
        .join('\n'),
      steps: (recipe.steps ?? []).map((step, index) => ({
        id: step.id,
        sortOrder: step.sortOrder,
        body: stepBody(index, step.body),
        imageUrl: step.imageUrl,
      })),
      ...(meta?.includeTranslations
        ? {
            translations: texts.map((text) => ({
              locale: text.locale,
              title: text.title,
              description: text.description,
              steps: alignSteps(text, stepCount).steps,
              notes: Object.entries(text.notes).map(([foodId, note]) => ({
                foodId,
                note,
              })),
              complete: isComplete(text, stepCount),
              origin: text.origin,
              translatedById: text.translatedById,
            })),
          }
        : {}),
      ...(viewerUserId ? { saved } : {}),
      contentVersion: meta?.contentVersion ?? recipe.publishedVersion ?? null,
      moderationStatus:
        meta?.moderationStatus ??
        (recipe.publishedVersion != null
          ? RecipeModerationStatus.APPROVED
          : null),
      publishedVersion:
        meta?.publishedVersion ?? recipe.publishedVersion ?? null,
      ingredients: recipe.ingredients.map((item) => {
        const translation = pickTranslation(item.food.translations);
        return {
          foodId: item.foodId,
          foodName: translation?.name ?? item.food.slug,
          foodImageUrl: item.food.imageUrl ?? null,
          quantity: item.quantity,
          unit: item.unit,
          note: ingredientNote(item.foodId, item.note),
          optional: item.optional,
          sortOrder: item.sortOrder,
          ...(viewerUserId
            ? { inInventory: inventoryFoodIds.has(item.foodId) }
            : {}),
        };
      }),
      nutrition: await this.withTargetComparison(
        viewerUserId,
        aggregateRecipeNutrition({
          servings: recipe.servings,
          ingredients: recipe.ingredients.map((item) => {
            const translation = pickTranslation(item.food.translations);
            return {
              foodId: item.foodId,
              foodName: translation?.name ?? item.food.slug,
              quantity: item.quantity,
              unit: item.unit,
              optional: item.optional,
              nutrients: item.food.nutrients ?? [],
            };
          }),
        }),
      ),
    };
  }

  private async withTargetComparison(
    viewerUserId: string | undefined,
    nutrition: ReturnType<typeof aggregateRecipeNutrition>,
  ) {
    if (!nutrition || !viewerUserId) return nutrition;
    const targetComparison = await this.nutrition.comparisonForUser(
      viewerUserId,
      nutrition.perServing,
    );
    return targetComparison ? { ...nutrition, targetComparison } : nutrition;
  }

  async listPendingRevisions() {
    const recipes = await this.prisma.recipe.findMany({
      where: { groupId: null },
      include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return recipes
      .filter(
        (recipe) =>
          recipe.revisions[0]?.moderationStatus ===
          RecipeModerationStatus.PENDING,
      )
      .map((recipe) => {
        const latest = recipe.revisions[0];
        const header = this.revisionHeader(latest, recipe.authorId);
        return {
          recipeId: recipe.id,
          slug: recipe.slug,
          version: latest.version,
          title: header.title,
          sourceLocale: header.sourceLocale,
          availableLocales: header.availableLocales,
          visibility: latest.visibility,
          authorId: recipe.authorId,
          publishedVersion: recipe.publishedVersion,
          submittedAt: latest.createdAt,
        };
      });
  }

  async getRevisionForReview(recipeId: string, version?: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: this.detailInclude(),
    });
    if (!recipe || recipe.groupId) {
      throw new NotFoundException(`Recipe '${recipeId}' not found`);
    }
    const revision = version
      ? await this.prisma.recipeRevision.findUnique({
          where: { recipeId_version: { recipeId, version } },
        })
      : await this.latestRevision(recipeId);
    if (!revision) {
      throw new NotFoundException(`Recipe '${recipeId}' has no revision`);
    }
    const detail = await this.toDetailFromRevision(
      recipe,
      revision,
      undefined,
      undefined,
      true,
    );
    const privateFoods = await this.catalog.privateFoodsForReview(
      detail.ingredients.map((item) => item.foodId),
    );
    return { ...detail, privateFoods };
  }

  async approveRevision(
    recipeId: string,
    actor: AuthUser,
    dto: ReviewRecipeDto,
  ) {
    const detail = await this.reviewRevision(recipeId, actor, dto, 'approve');
    await this.search.upsertPublicRecipe(recipeId);
    return detail;
  }

  async rejectRevision(
    recipeId: string,
    actor: AuthUser,
    dto: ReviewRecipeDto,
  ) {
    return this.reviewRevision(recipeId, actor, dto, 'reject');
  }

  private async reviewRevision(
    recipeId: string,
    actor: AuthUser,
    dto: ReviewRecipeDto,
    action: 'approve' | 'reject',
  ) {
    await this.prisma.$transaction(async (tx) => {
      const latest = await tx.recipeRevision.findFirst({
        where: { recipeId },
        orderBy: { version: 'desc' },
      });
      if (!latest || latest.version !== dto.version) {
        throw new ConflictException(
          'Recipe changed since this review. Reload the latest version before deciding.',
        );
      }
      if (latest.moderationStatus !== RecipeModerationStatus.PENDING) {
        throw new BadRequestException('Only a pending version can be reviewed');
      }

      if (action === 'reject') {
        await tx.recipeRevision.update({
          where: { id: latest.id },
          data: {
            moderationStatus: RecipeModerationStatus.REJECTED,
            rejectReason: dto.reason?.trim() || null,
            reviewedAt: new Date(),
            reviewedByUserId: actor.id,
          },
        });
        return tx.recipe.findUniqueOrThrow({
          where: { id: recipeId },
          include: this.detailInclude(),
        });
      }

      const steps = this.parseStepSnaps(latest.stepsJson);
      const snapIngredients = this.parseIngredientSnaps(latest.ingredientsJson);
      const current = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        select: { authorId: true },
      });
      const { ingredients, mapFoodId } = await this.resolveFoodsForApproval(
        tx,
        snapIngredients,
        dto.foods ?? [],
      );
      const texts = remapNotes(
        textsFromRevision(latest, steps, snapIngredients, current.authorId),
        mapFoodId,
      );
      await tx.recipeIngredient.deleteMany({ where: { recipeId } });
      await tx.recipeStep.deleteMany({ where: { recipeId } });
      const published = await tx.recipe.update({
        where: { id: recipeId },
        data: {
          title: latest.title,
          description: latest.description,
          servings: latest.servings,
          prepTimeMin: latest.prepTimeMin,
          cookTimeMin: latest.cookTimeMin,
          difficulty: latest.difficulty,
          instructions: latest.instructions,
          imageUrl: latest.imageUrl,
          videoUrl: latest.videoUrl,
          visibility: latest.visibility,
          publishedVersion: latest.version,
          ingredients: { create: this.mapIngredientCreates(ingredients) },
          steps: { create: this.mapStepCreates(steps) },
        },
        include: {
          steps: { orderBy: { sortOrder: 'asc' } },
          ingredients: true,
        },
      });
      await writeTexts(
        tx,
        this.textTargets(published, latest.sourceLocale, texts),
      );
      await tx.recipeRevision.update({
        where: { id: latest.id },
        data: {
          moderationStatus: RecipeModerationStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedByUserId: actor.id,
          rejectReason: null,
          ingredientsJson: ingredients as unknown as Prisma.InputJsonValue,
        },
      });
      return tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: this.detailInclude(),
      });
    });

    return this.getRevisionForReview(recipeId, dto.version);
  }

  private async resolveFoodsForApproval(
    tx: Prisma.TransactionClient,
    ingredients: RecipeIngredientInputDto[],
    decisions: ReviewFoodDecisionDto[],
  ): Promise<{
    ingredients: RecipeIngredientInputDto[];
    /** Where a merged private food's ingredient (and its notes) ends up. */
    mapFoodId: (foodId: string) => string;
  }> {
    const foodIds = [...new Set(ingredients.map((item) => item.foodId))];
    const foods = foodIds.length
      ? await tx.food.findMany({
          where: { id: { in: foodIds } },
          include: { translations: true },
        })
      : [];
    const byId = new Map(foods.map((food) => [food.id, food]));
    const decisionByFood = new Map(
      decisions.map((decision) => [decision.foodId, decision]),
    );
    const replacements = new Map<string, string>();
    const promoteIds: string[] = [];

    for (const food of foods) {
      if (food.visibility !== FoodVisibility.PRIVATE) continue;
      const name = pickTranslation(food.translations)?.name ?? food.slug;
      const suggestions = await this.catalog.privateFoodsForReview([food.id]);
      const suggestionList = suggestions[0]?.suggestions ?? [];
      const decision = decisionByFood.get(food.id);
      if (suggestionList.length && !decision) {
        throw new BadRequestException(
          `Choose merge or promote for private food '${name}' before approving`,
        );
      }
      if (!decision || decision.action === 'promote') {
        promoteIds.push(food.id);
        continue;
      }
      if (!decision.toFoodId) {
        throw new BadRequestException(`Merge for '${name}' needs toFoodId`);
      }
      if (decision.toFoodId === food.id) {
        throw new BadRequestException(`Cannot merge '${name}' into itself`);
      }
      const target = await tx.food.findUnique({
        where: { id: decision.toFoodId },
      });
      if (!target) {
        throw new NotFoundException(`Food '${decision.toFoodId}' not found`);
      }
      replacements.set(food.id, decision.toFoodId);
    }

    const finalTarget = (foodId: string): string => {
      const seen = new Set<string>();
      let current = foodId;
      while (replacements.has(current)) {
        if (seen.has(current)) {
          throw new BadRequestException('Food merge decisions form a cycle');
        }
        seen.add(current);
        current = replacements.get(current)!;
      }
      return current;
    };

    const merges = new Map<string, string>();
    for (const foodId of replacements.keys()) {
      const target = finalTarget(foodId);
      if (target !== foodId) merges.set(foodId, target);
    }

    const rewritten = collapseIngredients(
      ingredients.map((item) => ({
        ...item,
        foodId: finalTarget(item.foodId),
      })),
    );

    for (const [fromFoodId, toFoodId] of merges) {
      if (!byId.has(fromFoodId)) continue;
      await this.catalog.mergeFoods(tx, fromFoodId, toFoodId);
    }

    const stillPromote = promoteIds.filter((id) => !merges.has(id));
    await this.catalog.promoteFoods(tx, stillPromote);
    return { ingredients: rewritten, mapFoodId: finalTarget };
  }

  private async submitCatalogRevision(
    recipeId: string,
    dto: UpdateRecipeDto,
    actor: AuthUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: this.detailInclude(),
      });
      const latest = await tx.recipeRevision.findFirst({
        where: { recipeId },
        orderBy: { version: 'desc' },
      });
      const baseIngredients = latest
        ? this.parseIngredientSnaps(latest.ingredientsJson)
        : recipe.ingredients.map((item) => ({
            foodId: item.foodId,
            quantity: item.quantity,
            unit: item.unit,
            note: item.note ?? undefined,
            optional: item.optional,
            sortOrder: item.sortOrder,
          }));
      const baseSteps = latest
        ? this.parseStepSnaps(latest.stepsJson)
        : recipe.steps.map((step) => ({
            body: step.body,
            imageUrl: step.imageUrl,
            sortOrder: step.sortOrder,
          }));
      const replaceSteps =
        dto.steps !== undefined || dto.instructions !== undefined;
      const steps = replaceSteps
        ? this.resolveStepsInput(dto.steps, dto.instructions)
        : baseSteps;
      const ingredients = dto.ingredients?.length
        ? this.mapIngredientCreates(dto.ingredients)
        : baseIngredients;
      const base = latest
        ? textsFromRevision(latest, baseSteps, baseIngredients, recipe.authorId)
        : textsFromRows(recipe);
      const { sourceLocale, texts } = this.buildTexts({
        base,
        currentSource: latest?.sourceLocale ?? recipe.sourceLocale,
        dto,
        steps,
        stepsReplaced: replaceSteps,
        ingredients,
        ingredientsReplaced: Boolean(dto.ingredients?.length),
        actorId: actor.id,
      });
      const sourceText = texts[0];

      await tx.recipe.update({
        where: { id: recipeId },
        data: { updatedAt: new Date() },
      });
      const created = await tx.recipeRevision.create({
        data: {
          recipeId,
          version: (latest?.version ?? 0) + 1,
          moderationStatus: RecipeModerationStatus.PENDING,
          sourceLocale,
          translationsJson: textsToJson(texts),
          title: sourceText.title,
          description: sourceText.description,
          servings: dto.servings ?? latest?.servings ?? recipe.servings,
          prepTimeMin:
            dto.prepTimeMin !== undefined
              ? dto.prepTimeMin
              : (latest?.prepTimeMin ?? recipe.prepTimeMin),
          cookTimeMin:
            dto.cookTimeMin !== undefined
              ? dto.cookTimeMin
              : (latest?.cookTimeMin ?? recipe.cookTimeMin),
          difficulty: dto.difficulty ?? latest?.difficulty ?? recipe.difficulty,
          instructions: sourceText.steps.join('\n'),
          imageUrl:
            dto.imageUrl !== undefined
              ? dto.imageUrl
              : (latest?.imageUrl ?? recipe.imageUrl),
          videoUrl:
            dto.videoUrl !== undefined
              ? dto.videoUrl
              : (latest?.videoUrl ?? recipe.videoUrl),
          visibility: dto.visibility ?? latest?.visibility ?? recipe.visibility,
          // Legacy snapshot fields mirror the source locale.
          ingredientsJson: ingredients.map((item) => ({
            ...item,
            note: sourceText.notes[item.foodId] ?? null,
          })) as unknown as Prisma.InputJsonValue,
          stepsJson: steps.map((step, index) => ({
            ...step,
            body: sourceText.steps[index] ?? step.body,
          })) as unknown as Prisma.InputJsonValue,
        },
      });
      return created;
    });
  }

  private revisionData(
    recipe: RecipeWithIngredients,
    version: number,
    moderationStatus: RecipeModerationStatus,
    texts: RecipeText[],
  ) {
    return {
      recipeId: recipe.id,
      version,
      moderationStatus,
      sourceLocale: recipe.sourceLocale,
      translationsJson: textsToJson(texts),
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl,
      videoUrl: recipe.videoUrl,
      visibility: recipe.visibility,
      ingredientsJson: recipe.ingredients.map((item) => ({
        foodId: item.foodId,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        optional: item.optional,
        sortOrder: item.sortOrder,
      })),
      stepsJson: recipe.steps.map((step) => ({
        body: step.body,
        imageUrl: step.imageUrl,
        sortOrder: step.sortOrder,
      })),
    };
  }

  private latestRevision(recipeId: string) {
    return this.prisma.recipeRevision.findFirst({
      where: { recipeId },
      orderBy: { version: 'desc' },
    });
  }

  private canModerate(actor?: AuthUser | null) {
    const permissions = actor?.permissions ?? [];
    return (
      permissions.includes('moderation:manage') ||
      permissions.includes('system:manage')
    );
  }

  private async toDetailFromRevision(
    recipe: RecipeWithIngredients,
    revision: {
      version: number;
      moderationStatus: RecipeModerationStatus;
      title: string;
      description: string | null;
      servings: number;
      prepTimeMin: number | null;
      cookTimeMin: number | null;
      difficulty: RecipeDifficulty;
      instructions: string;
      imageUrl: string | null;
      videoUrl: string | null;
      visibility: RecipeVisibility;
      ingredientsJson: Prisma.JsonValue;
      stepsJson: Prisma.JsonValue;
      sourceLocale: string;
      translationsJson: Prisma.JsonValue | null;
    },
    viewerUserId?: string,
    groupId?: string,
    includeTranslations = false,
  ) {
    const ingredients = this.parseIngredientSnaps(revision.ingredientsJson);
    const steps = this.parseStepSnaps(revision.stepsJson);
    const texts = textsFromRevision(
      revision,
      steps,
      ingredients,
      recipe.authorId,
    );
    const foodIds = ingredients.map((item) => item.foodId);
    const foods = foodIds.length
      ? await this.prisma.food.findMany({
          where: { id: { in: foodIds } },
          include: {
            translations: true,
            nutrients: {
              include: { nutrient: { include: { translations: true } } },
              orderBy: { nutrient: { sortOrder: 'asc' } },
            },
          },
        })
      : [];
    const foodById = new Map(foods.map((food) => [food.id, food]));
    const overlaid = {
      ...recipe,
      sourceLocale: revision.sourceLocale,
      title: revision.title,
      description: revision.description,
      servings: revision.servings,
      prepTimeMin: revision.prepTimeMin,
      cookTimeMin: revision.cookTimeMin,
      difficulty: revision.difficulty,
      instructions: revision.instructions,
      imageUrl: revision.imageUrl,
      videoUrl: revision.videoUrl,
      visibility: revision.visibility,
      ingredients: ingredients.map((item, index) => {
        const food = foodById.get(item.foodId) ?? {
          id: item.foodId,
          slug: item.foodId,
          imageUrl: null,
          translations: [],
          nutrients: [],
        };
        return {
          id: `draft-${index}`,
          recipeId: recipe.id,
          foodId: item.foodId,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note ?? null,
          optional: item.optional ?? false,
          sortOrder: item.sortOrder ?? index,
          food,
          translations: [],
        };
      }),
      steps: steps.map((step, index) => ({
        id: `draft-step-${index}`,
        recipeId: recipe.id,
        sortOrder: step.sortOrder ?? index,
        body: step.body,
        imageUrl: step.imageUrl,
        translations: [],
      })),
    } as RecipeWithIngredients;

    return this.toDetail(overlaid, viewerUserId, groupId, {
      contentVersion: revision.version,
      moderationStatus: revision.moderationStatus,
      publishedVersion: recipe.publishedVersion,
      texts,
      includeTranslations,
    });
  }

  /** Card text of a revision (drafts in Studio, moderation queue). */
  private revisionHeader(
    revision: {
      sourceLocale: string;
      title: string;
      description: string | null;
      translationsJson: Prisma.JsonValue | null;
      stepsJson: Prisma.JsonValue;
      ingredientsJson: Prisma.JsonValue;
    },
    authorId: string,
  ) {
    const steps = this.parseStepSnaps(revision.stepsJson);
    const texts = textsFromRevision(
      revision,
      steps,
      this.parseIngredientSnaps(revision.ingredientsJson),
      authorId,
    );
    const { text, displayLocale } = resolveText(
      texts,
      revision.sourceLocale,
      currentLocale(),
      steps.length,
    );
    return {
      title: text.title,
      description: text.description,
      sourceLocale: revision.sourceLocale,
      displayLocale,
      availableLocales: availableLocales(
        texts,
        revision.sourceLocale,
        steps.length,
      ),
    };
  }

  /**
   * Moderator adds or fixes a translation (requirements 2b.3 #2).
   * - Latest revision PENDING: saved into that revision; approving publishes it.
   * - Otherwise: a new revision with only this change, approved right away.
   */
  async upsertTranslationAsModerator(
    recipeId: string,
    locale: string,
    dto: RecipeTranslationBodyDto,
    actor: AuthUser,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: this.detailInclude(),
    });
    if (!recipe || recipe.groupId) {
      throw new NotFoundException(`Recipe '${recipeId}' not found`);
    }
    const input = { ...dto, locale };
    const latest = await this.latestRevision(recipeId);

    if (latest?.moderationStatus === RecipeModerationStatus.PENDING) {
      const steps = this.parseStepSnaps(latest.stepsJson);
      const ingredients = this.parseIngredientSnaps(latest.ingredientsJson);
      const text = this.moderatorText(
        input,
        latest.sourceLocale,
        steps.length,
        ingredients,
        actor,
      );
      const texts = textsFromRevision(
        latest,
        steps,
        ingredients,
        recipe.authorId,
      ).filter((item) => item.locale !== text.locale);
      const updated = await this.prisma.recipeRevision.updateMany({
        where: {
          id: latest.id,
          version: latest.version,
          moderationStatus: RecipeModerationStatus.PENDING,
        },
        data: { translationsJson: textsToJson([...texts, text]) },
      });
      if (updated.count === 0) {
        throw new ConflictException(
          'Recipe changed since this review. Reload the latest version.',
        );
      }
      return this.getRevisionForReview(recipeId, latest.version);
    }

    if (recipe.publishedVersion == null) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.RECIPE_NOT_PUBLISHED,
        'Recipe has no published or pending version to translate',
      );
    }
    const text = this.moderatorText(
      input,
      recipe.sourceLocale,
      recipe.steps.length,
      recipe.ingredients,
      actor,
    );
    const texts = [
      ...textsFromRows(recipe).filter((item) => item.locale !== text.locale),
      text,
    ];
    const version = (latest?.version ?? 0) + 1;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.recipeRevision.create({
          data: {
            ...this.revisionData(
              recipe,
              version,
              RecipeModerationStatus.APPROVED,
              texts,
            ),
            reviewedAt: new Date(),
            reviewedByUserId: actor.id,
          },
        });
        await writeTexts(
          tx,
          this.textTargets(recipe, recipe.sourceLocale, texts),
        );
        await tx.recipe.update({
          where: { id: recipeId },
          data: { publishedVersion: version },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Recipe changed meanwhile. Reload and retry.',
        );
      }
      throw error;
    }
    await this.search.upsertPublicRecipe(recipeId);
    return this.getRevisionForReview(recipeId, version);
  }

  private moderatorText(
    input: RecipeTextInput,
    sourceLocale: string,
    stepCount: number,
    ingredients: Array<{ foodId: string }>,
    actor: AuthUser,
  ): RecipeText {
    const text = textFromInput(
      input,
      stepCount,
      new Set(ingredients.map((item) => item.foodId)),
      TranslationOrigin.MODERATOR,
      actor.id,
    );
    if (text.locale === sourceLocale) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.TRANSLATION_IS_SOURCE,
        `'${text.locale}' is the source locale of this recipe`,
        { locale: text.locale },
      );
    }
    return text;
  }

  /** Published catalog recipes without a complete `locale` translation (2b.3 #3). */
  async listMissingTranslations(locale: string) {
    if (!isSupportedLocale(locale)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LOCALE_NOT_SUPPORTED,
        `Locale '${locale}' is not supported`,
        { locale },
      );
    }
    const recipes = await this.prisma.recipe.findMany({
      where: {
        groupId: null,
        visibility: RecipeVisibility.PUBLIC,
        publishedVersion: { not: null },
      },
      include: {
        ...recipeHeaderInclude,
        revisions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return recipes
      .map((recipe) => ({
        recipe,
        header: localizedHeader(recipe, recipe.sourceLocale),
      }))
      .filter(({ header }) => !header.availableLocales.includes(locale))
      .map(({ recipe, header }) => ({
        recipeId: recipe.id,
        slug: recipe.slug,
        title: header.title,
        sourceLocale: recipe.sourceLocale,
        availableLocales: header.availableLocales,
        hasPendingRevision:
          recipe.revisions[0]?.moderationStatus ===
          RecipeModerationStatus.PENDING,
        publishedVersion: recipe.publishedVersion,
      }));
  }

  private parseIngredientSnaps(
    value: Prisma.JsonValue,
  ): RecipeIngredientInputDto[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      if (typeof row.foodId !== 'string') return [];
      return [
        {
          foodId: row.foodId,
          quantity: Number(row.quantity ?? 0),
          unit: String(row.unit ?? 'g') as RecipeIngredientInputDto['unit'],
          note: typeof row.note === 'string' ? row.note : undefined,
          optional: Boolean(row.optional),
          sortOrder: Number(row.sortOrder ?? 0),
        },
      ];
    });
  }

  private parseStepSnaps(
    value: Prisma.JsonValue,
  ): Array<{ body: string; imageUrl: string | null; sortOrder: number }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      if (typeof row.body !== 'string') return [];
      return [
        {
          body: row.body,
          imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
          sortOrder: Number(row.sortOrder ?? index),
        },
      ];
    });
  }
}
