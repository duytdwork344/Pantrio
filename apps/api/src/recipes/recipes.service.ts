import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentEventType,
  GroupMemberRole,
  Prisma,
  RecipeDifficulty,
  RecipeVisibility,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertFoodsUsable as ensureFoodsUsable } from '../common/foods/assert-food-usable';
import { pickTranslation } from '../common/i18n/locale';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGroupRecipeDto,
  CreateRecipeDto,
  RecipeDetailDto,
  RecipeIngredientInputDto,
  RecipeStepInputDto,
  RecipeSummaryDto,
  ShareChannel,
  ShareRecipeResultDto,
  UpdateGroupRecipeDto,
  UpdateRecipeDto,
} from './dto/recipe.dto';

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
    ingredients: {
      include: {
        food: {
          include: { translations: true };
        };
      };
    };
    steps: true;
  };
}>;

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  async list(): Promise<RecipeSummaryDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { visibility: RecipeVisibility.PUBLIC, groupId: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return recipes.map((recipe) => this.toSummary(recipe));
  }

  /** Catalog recipes authored by the user (excludes group cookbook). */
  async listMine(userId: string): Promise<RecipeSummaryDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { authorId: userId, groupId: null },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return recipes.map((recipe) => this.toSummary(recipe));
  }

  async listGroupCookbook(userId: string): Promise<RecipeSummaryDto[]> {
    const membership = await this.groups.requireMembership(userId);
    const recipes = await this.prisma.recipe.findMany({
      where: {
        groupId: membership.groupId,
        visibility: RecipeVisibility.GROUP,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return recipes.map((recipe) => this.toSummary(recipe));
  }

  async findBySlug(
    slug: string,
    viewerUserId?: string,
    groupId?: string,
  ): Promise<RecipeDetailDto | null> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { slug },
      include: this.detailInclude(),
    });

    if (!recipe) {
      return null;
    }

    if (recipe.visibility === RecipeVisibility.GROUP || recipe.groupId) {
      if (!viewerUserId || !recipe.groupId) {
        return null;
      }
      await this.groups.requireMembership(viewerUserId, recipe.groupId);
      // Pantry flags default to the recipe's group when not overridden.
      return this.toDetail(recipe, viewerUserId, groupId ?? recipe.groupId);
    }

    return this.toDetail(recipe, viewerUserId, groupId);
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
    return this.toDetail(recipe, userId, membership.groupId);
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
      include: { recipe: true },
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

    const recipe = await this.prisma.recipe.create({
      data: {
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
        visibility,
        ingredients: {
          create: this.mapIngredientCreates(dto.ingredients),
        },
        steps: {
          create: this.mapStepCreates(resolvedSteps),
        },
      },
      include: this.detailInclude(),
    });

    return this.toDetail(recipe);
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

    const recipe = await this.prisma.recipe.create({
      data: {
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
        visibility: RecipeVisibility.GROUP,
        ingredients: {
          create: this.mapIngredientCreates(dto.ingredients),
        },
        steps: {
          create: this.mapStepCreates(resolvedSteps),
        },
      },
      include: this.detailInclude(),
    });

    return this.toDetail(recipe, author.id, membership.groupId);
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

    const recipe = await this.applyRecipePatch(id, existing.slug, existing.title, dto);
    return this.toDetail(recipe);
  }

  async updateForGroup(
    id: string,
    actor: AuthUser,
    dto: UpdateGroupRecipeDto,
  ): Promise<RecipeDetailDto> {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
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

    const recipe = await this.applyRecipePatch(id, existing.slug, existing.title, {
      ...dto,
      // Keep GROUP invariant
      visibility: RecipeVisibility.GROUP,
    });
    return this.toDetail(recipe, actor.id, existing.groupId);
  }

  async deleteForGroup(id: string, actor: AuthUser): Promise<{ deleted: true; id: string }> {
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

  private async applyRecipePatch(
    id: string,
    existingSlug: string,
    existingTitle: string,
    dto: UpdateRecipeDto | (UpdateGroupRecipeDto & { visibility?: RecipeVisibility }),
  ) {
    let slug = existingSlug;
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

    return this.prisma.$transaction(async (tx) => {
      if (dto.ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      }
      if (resolvedSteps) {
        await tx.recipeStep.deleteMany({ where: { recipeId: id } });
      }

      return tx.recipe.update({
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
      });
    });
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
      return steps.map((step, index) => ({
        body: step.body.trim(),
        imageUrl: step.imageUrl?.trim() || null,
        sortOrder: step.sortOrder ?? index,
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

  private deriveInstructions(
    steps: Array<{ body: string }>,
  ): string {
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
      ingredients: {
        include: {
          food: {
            include: { translations: true },
          },
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      steps: {
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
    shareCount: number;
  }): RecipeSummaryDto {
    return {
      id: recipe.id,
      title: recipe.title,
      slug: recipe.slug,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
      shareCount: recipe.shareCount,
    };
  }

  private async toDetail(
    recipe: RecipeWithIngredients,
    viewerUserId?: string,
    groupId?: string,
  ): Promise<RecipeDetailDto> {
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
      authorId: recipe.authorId,
      groupId: recipe.groupId ?? null,
      visibility: recipe.visibility,
      instructions: recipe.instructions,
      steps: (recipe.steps ?? []).map((step) => ({
        id: step.id,
        sortOrder: step.sortOrder,
        body: step.body,
        imageUrl: step.imageUrl,
      })),
      ...(viewerUserId ? { saved } : {}),
      ingredients: recipe.ingredients.map((item) => {
        const translation = pickTranslation(item.food.translations);
        return {
          foodId: item.foodId,
          foodName: translation?.name ?? item.food.slug,
          foodImageUrl: item.food.imageUrl ?? null,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          optional: item.optional,
          sortOrder: item.sortOrder,
          ...(viewerUserId
            ? { inInventory: inventoryFoodIds.has(item.foodId) }
            : {}),
        };
      }),
    };
  }
}
