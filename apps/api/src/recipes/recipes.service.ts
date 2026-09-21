import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
  CreateRecipeDto,
  RecipeDetailDto,
  RecipeIngredientInputDto,
  RecipeSummaryDto,
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
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    return this.toDetail(recipe, viewerUserId, groupId);
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
    const slug = dto.slug?.trim()
      ? await this.resolveUniqueSlug(dto.slug, { allowSuffix: false })
      : await this.resolveUniqueSlug(dto.title, { allowSuffix: true });
    await this.assertFoodsUsable(dto.ingredients, author);

    const recipe = await this.prisma.recipe.create({
      data: {
        authorId: author.id,
        title: dto.title.trim(),
        slug,
        description: dto.description?.trim() || null,
        servings: dto.servings ?? 2,
        prepTimeMin: dto.prepTimeMin ?? null,
        cookTimeMin: dto.cookTimeMin ?? null,
        difficulty: dto.difficulty ?? RecipeDifficulty.EASY,
        instructions: dto.instructions.trim(),
        imageUrl: dto.imageUrl ?? null,
        visibility: dto.visibility ?? RecipeVisibility.PUBLIC,
        ingredients: {
          create: this.mapIngredientCreates(dto.ingredients),
        },
      },
      include: this.detailInclude(),
    });

    return this.toDetail(recipe);
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

    this.assertCanEdit(existing.authorId, actor);

    if (dto.ingredients?.length) {
      await this.assertFoodsUsable(dto.ingredients, actor);
    }

    let slug = existing.slug;
    if (dto.slug?.trim()) {
      slug = await this.resolveUniqueSlug(dto.slug, {
        excludeRecipeId: id,
        allowSuffix: false,
      });
    } else if (dto.title?.trim() && dto.title.trim() !== existing.title) {
      slug = await this.resolveUniqueSlug(dto.title, {
        excludeRecipeId: id,
        allowSuffix: true,
      });
    }

    const recipe = await this.prisma.$transaction(async (tx) => {
      if (dto.ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
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
          ...(dto.instructions !== undefined
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
        },
        include: this.detailInclude(),
      });
    });

    return this.toDetail(recipe);
  }

  private assertCanEdit(authorId: string, actor: AuthUser) {
    const isAuthor = authorId === actor.id;
    const isElevated =
      actor.permissions.includes('system:manage') ||
      actor.permissions.includes('moderation:manage');

    if (!isAuthor && !isElevated) {
      throw new ForbiddenException('You can only edit your own recipes');
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
      visibility: recipe.visibility,
      instructions: recipe.instructions,
      ...(viewerUserId ? { saved } : {}),
      ingredients: recipe.ingredients.map((item) => {
        const translation = pickTranslation(item.food.translations);
        return {
          foodId: item.foodId,
          foodName: translation?.name ?? item.food.slug,
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
