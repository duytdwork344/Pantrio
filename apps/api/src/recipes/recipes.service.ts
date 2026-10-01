import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentEventType,
  FoodVisibility,
  GroupMemberRole,
  Prisma,
  RecipeDifficulty,
  RecipeModerationStatus,
  RecipeVisibility,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertFoodsUsable as ensureFoodsUsable } from '../common/foods/assert-food-usable';
import { pickTranslation } from '../common/i18n/locale';
import { GroupsService } from '../groups/groups.service';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGroupRecipeDto,
  CreateRecipeDto,
  RecipeDetailDto,
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
    private readonly catalog: CatalogService,
  ) {}

  async list(): Promise<RecipeSummaryDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        visibility: RecipeVisibility.PUBLIC,
        groupId: null,
        publishedVersion: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return recipes.map((recipe) => this.toSummary(recipe));
  }

  /** Catalog recipes authored by the user (excludes group cookbook). */
  async listMine(userId: string): Promise<RecipeSummaryDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { authorId: userId, groupId: null },
      include: {
        revisions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return recipes.map((recipe) => {
      const latest = recipe.revisions[0];
      const showingDraft =
        latest != null && latest.version !== recipe.publishedVersion;
      return {
        ...this.toSummary(recipe),
        ...(showingDraft
          ? {
              title: latest.title,
              description: latest.description,
              servings: latest.servings,
              prepTimeMin: latest.prepTimeMin,
              cookTimeMin: latest.cookTimeMin,
              difficulty: latest.difficulty,
              imageUrl: latest.imageUrl,
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
      return this.toDetail(recipe, viewerUserId, groupId ?? recipe.groupId);
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

    if (canSeeDraft && latest) {
      return this.toDetailFromRevision(recipe, latest, viewerUserId, groupId);
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

    await this.prisma.recipeRevision.create({
      data: this.revisionData(recipe, 1, RecipeModerationStatus.PENDING),
    });

    return this.toDetail(recipe, author.id, undefined, {
      contentVersion: 1,
      moderationStatus: RecipeModerationStatus.PENDING,
      publishedVersion: null,
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

    const revision = await this.submitCatalogRevision(id, dto);
    const recipe = await this.prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: this.detailInclude(),
    });
    return this.toDetailFromRevision(recipe, revision, actor.id);
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
    meta?: {
      contentVersion?: number | null;
      moderationStatus?: RecipeModerationStatus | null;
      publishedVersion?: number | null;
    },
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
      contentVersion: meta?.contentVersion ?? recipe.publishedVersion ?? null,
      moderationStatus:
        meta?.moderationStatus ??
        (recipe.publishedVersion != null
          ? RecipeModerationStatus.APPROVED
          : null),
      publishedVersion: meta?.publishedVersion ?? recipe.publishedVersion ?? null,
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

  async listPendingRevisions() {
    const recipes = await this.prisma.recipe.findMany({
      where: { groupId: null },
      include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return recipes
      .filter((recipe) => recipe.revisions[0]?.moderationStatus === RecipeModerationStatus.PENDING)
      .map((recipe) => {
        const latest = recipe.revisions[0];
        return {
          recipeId: recipe.id,
          slug: recipe.slug,
          version: latest.version,
          title: latest.title,
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
    const detail = await this.toDetailFromRevision(recipe, revision);
    const privateFoods = await this.catalog.privateFoodsForReview(
      detail.ingredients.map((item) => item.foodId),
    );
    return { ...detail, privateFoods };
  }

  async approveRevision(recipeId: string, actor: AuthUser, dto: ReviewRecipeDto) {
    return this.reviewRevision(recipeId, actor, dto, 'approve');
  }

  async rejectRevision(recipeId: string, actor: AuthUser, dto: ReviewRecipeDto) {
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
      const ingredients = await this.resolveFoodsForApproval(
        tx,
        this.parseIngredientSnaps(latest.ingredientsJson),
        dto.foods ?? [],
      );
      await tx.recipeIngredient.deleteMany({ where: { recipeId } });
      await tx.recipeStep.deleteMany({ where: { recipeId } });
      await tx.recipe.update({
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
          visibility: latest.visibility,
          publishedVersion: latest.version,
          ingredients: { create: this.mapIngredientCreates(ingredients) },
          steps: { create: this.mapStepCreates(steps) },
        },
      });
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
  ): Promise<RecipeIngredientInputDto[]> {
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
      const name =
        food.translations.find((item) => item.locale === 'vi')?.name ??
        food.slug;
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
        throw new BadRequestException(
          `Merge for '${name}' needs toFoodId`,
        );
      }
      if (decision.toFoodId === food.id) {
        throw new BadRequestException(`Cannot merge '${name}' into itself`);
      }
      const target = await tx.food.findUnique({
        where: { id: decision.toFoodId },
      });
      if (!target) {
        throw new NotFoundException(
          `Food '${decision.toFoodId}' not found`,
        );
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
    return rewritten;
  }

  private async submitCatalogRevision(recipeId: string, dto: UpdateRecipeDto) {
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

      await tx.recipe.update({
        where: { id: recipeId },
        data: { updatedAt: new Date() },
      });
      const created = await tx.recipeRevision.create({
        data: {
          recipeId,
          version: (latest?.version ?? 0) + 1,
          moderationStatus: RecipeModerationStatus.PENDING,
          title: dto.title?.trim() || latest?.title || recipe.title,
          description:
            dto.description !== undefined
              ? dto.description?.trim() || null
              : (latest?.description ?? recipe.description),
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
          instructions: this.deriveInstructions(steps),
          imageUrl:
            dto.imageUrl !== undefined
              ? dto.imageUrl
              : (latest?.imageUrl ?? recipe.imageUrl),
          visibility: dto.visibility ?? latest?.visibility ?? recipe.visibility,
          ingredientsJson: ingredients as unknown as Prisma.InputJsonValue,
          stepsJson: steps as unknown as Prisma.InputJsonValue,
        },
      });
      return created;
    });
  }

  private revisionData(
    recipe: RecipeWithIngredients,
    version: number,
    moderationStatus: RecipeModerationStatus,
  ) {
    return {
      recipeId: recipe.id,
      version,
      moderationStatus,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl,
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
      visibility: RecipeVisibility;
      ingredientsJson: Prisma.JsonValue;
      stepsJson: Prisma.JsonValue;
    },
    viewerUserId?: string,
    groupId?: string,
  ) {
    const ingredients = this.parseIngredientSnaps(revision.ingredientsJson);
    const steps = this.parseStepSnaps(revision.stepsJson);
    const foodIds = ingredients.map((item) => item.foodId);
    const foods = foodIds.length
      ? await this.prisma.food.findMany({
          where: { id: { in: foodIds } },
          include: { translations: true },
        })
      : [];
    const foodById = new Map(foods.map((food) => [food.id, food]));
    const overlaid = {
      ...recipe,
      title: revision.title,
      description: revision.description,
      servings: revision.servings,
      prepTimeMin: revision.prepTimeMin,
      cookTimeMin: revision.cookTimeMin,
      difficulty: revision.difficulty,
      instructions: revision.instructions,
      imageUrl: revision.imageUrl,
      visibility: revision.visibility,
      ingredients: ingredients.map((item, index) => {
        const food = foodById.get(item.foodId) ?? {
          id: item.foodId,
          slug: item.foodId,
          imageUrl: null,
          translations: [],
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
        };
      }),
      steps: steps.map((step, index) => ({
        id: `draft-step-${index}`,
        recipeId: recipe.id,
        sortOrder: step.sortOrder ?? index,
        body: step.body,
        imageUrl: step.imageUrl,
      })),
    } as RecipeWithIngredients;

    return this.toDetail(overlaid, viewerUserId, groupId, {
      contentVersion: revision.version,
      moderationStatus: revision.moderationStatus,
      publishedVersion: recipe.publishedVersion,
    });
  }

  private parseIngredientSnaps(value: Prisma.JsonValue): RecipeIngredientInputDto[] {
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
