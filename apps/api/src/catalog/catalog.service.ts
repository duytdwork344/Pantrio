import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_LOCALE, Permission, SUPPORTED_LOCALES } from '@pantrio/shared';
import { FoodVisibility, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  normalizeLocale,
  pickTranslation,
} from '../common/i18n/locale';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFoodDto,
  FoodDto,
  FoodReferenceCountsDto,
  MergeFoodDto,
  MergeFoodResultDto,
  ModeratedFoodDto,
  NutrientDto,
  ReplaceFoodNutrientsDto,
  UpdateFoodDto,
  UpsertFoodTranslationDto,
} from './dto/food.dto';
import { mapFoodNutrients } from '../common/nutrition/aggregate';
import { Unit } from '@pantrio/shared';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeFoodName(value: string): string {
  return slugify(value).replace(/-/g, '');
}

function namesOverlap(left: string, right: string): boolean {
  if (left.length < 3 || right.length < 3) return left === right && left.length > 0;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index >= 6;
}

function rewriteIngredientSnapshot(
  value: Prisma.JsonValue,
  fromFoodId: string,
  toFoodId: string,
): Prisma.InputJsonValue | null {
  if (!Array.isArray(value)) return null;
  let changed = false;
  const rows = value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [item];
    const row = item as Record<string, Prisma.JsonValue>;
    if (row.foodId !== fromFoodId) return [row];
    changed = true;
    return [{ ...row, foodId: toFoodId }];
  });
  if (!changed) return null;

  const collapsed: Array<Record<string, Prisma.JsonValue>> = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, Prisma.JsonValue>;
    const previous = collapsed.find((entry) => entry.foodId === row.foodId);
    if (!previous) {
      collapsed.push({ ...row });
      continue;
    }
    if (previous.unit === row.unit && typeof previous.quantity === 'number') {
      previous.quantity = previous.quantity + Number(row.quantity ?? 0);
    }
  }
  return collapsed;
}

type FoodWithTranslations = Prisma.FoodGetPayload<{
  include: { translations: true };
}> & {
  nutrients?: Array<{
    amount: number;
    basisQty: number;
    basisUnit: string;
    nutrient: {
      id: string;
      code: string;
      nameEn: string;
      nameVi: string;
      unit: string;
      group: import('@prisma/client').NutrientGroup;
      sortOrder: number;
    };
  }>;
};

const foodDetailInclude = {
  translations: true,
  nutrients: {
    include: { nutrient: true },
    orderBy: { nutrient: { sortOrder: 'asc' as const } },
  },
} satisfies Prisma.FoodInclude;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    q?: string;
    category?: string;
    locale?: string;
    viewer?: AuthUser;
  }): Promise<FoodDto[]> {
    const locale = normalizeLocale(params.locale);
    const where: Prisma.FoodWhereInput = {
      AND: [this.visibilityFilter(params.viewer)],
    };

    if (params.q?.trim()) {
      const q = params.q.trim();
      where.AND = [
        ...(where.AND as Prisma.FoodWhereInput[]),
        {
          OR: [
            { slug: { contains: q, mode: 'insensitive' } },
            {
              translations: {
                some: {
                  name: { contains: q, mode: 'insensitive' },
                },
              },
            },
          ],
        },
      ];
    }

    if (params.category?.trim()) {
      where.AND = [
        ...(where.AND as Prisma.FoodWhereInput[]),
        {
          translations: {
            some: {
              locale,
              category: {
                equals: params.category.trim(),
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const foods = await this.prisma.food.findMany({
      where,
      include: {
        translations: true,
        nutrients: { include: { nutrient: true } },
      },
      orderBy: { slug: 'asc' },
      take: 100,
    });

    return foods
      .map((food) => this.toDto(food, locale, true))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }

  async findBySlug(
    slug: string,
    locale?: string,
    viewer?: AuthUser,
  ): Promise<FoodDto> {
    const food = await this.prisma.food.findUnique({
      where: { slug },
      include: foodDetailInclude,
    });
    if (!food) {
      throw new NotFoundException(`Food '${slug}' not found`);
    }
    this.assertCanView(food, viewer);
    return this.toDto(food, normalizeLocale(locale), true);
  }

  async create(
    dto: CreateFoodDto,
    actor: AuthUser,
    locale?: string,
  ): Promise<FoodDto> {
    const canManageCatalog = this.canManageCatalog(actor);
    const visibility = canManageCatalog
      ? (dto.visibility ?? FoodVisibility.PUBLIC)
      : FoodVisibility.PRIVATE;

    if (!canManageCatalog && dto.visibility === FoodVisibility.PUBLIC) {
      throw new ForbiddenException(
        'Only catalog managers can create PUBLIC foods',
      );
    }

    const translations = this.normalizeTranslations(dto.translations);
    const primary =
      translations.find((item) => item.locale === DEFAULT_LOCALE) ??
      translations[0];
    const slug = await this.uniqueSlug(
      slugify(dto.slug?.trim() || primary.name),
    );

    try {
      const food = await this.prisma.food.create({
        data: {
          slug,
          measurementType: dto.measurementType,
          baseUnit: dto.baseUnit,
          imageUrl: dto.imageUrl ?? null,
          visibility,
          createdByUserId: actor.id,
          translations: {
            create: translations.map((item) => ({
              locale: item.locale,
              name: item.name,
              category: item.category ?? null,
            })),
          },
        },
        include: foodDetailInclude,
      });
      return this.toDto(food, normalizeLocale(locale), true);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Food slug or translation already exists');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateFoodDto,
    actor: AuthUser,
    locale?: string,
  ): Promise<FoodDto> {
    const existing = await this.prisma.food.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!existing) {
      throw new NotFoundException(`Food '${id}' not found`);
    }

    const canManageCatalog = this.canManageCatalog(actor);
    const isOwner = existing.createdByUserId === actor.id;

    if (!canManageCatalog && !isOwner) {
      throw new ForbiddenException('You cannot update this food');
    }

    if (
      dto.visibility !== undefined &&
      dto.visibility !== existing.visibility &&
      !canManageCatalog
    ) {
      throw new ForbiddenException(
        'Only catalog managers can change food visibility',
      );
    }

    if (!canManageCatalog) {
      // Owners may only edit their PRIVATE foods' content, not promote.
      if (existing.visibility !== FoodVisibility.PRIVATE) {
        throw new ForbiddenException('You can only edit your PRIVATE foods');
      }
    }

    try {
      const food = await this.prisma.$transaction(async (tx) => {
        if (dto.translations?.length) {
          const translations = this.normalizeTranslations(dto.translations);
          for (const item of translations) {
            await tx.foodTranslation.upsert({
              where: {
                foodId_locale: {
                  foodId: id,
                  locale: item.locale,
                },
              },
              update: {
                name: item.name,
                category: item.category ?? null,
              },
              create: {
                foodId: id,
                locale: item.locale,
                name: item.name,
                category: item.category ?? null,
              },
            });
          }
        }

        return tx.food.update({
          where: { id },
          data: {
            measurementType: dto.measurementType,
            baseUnit: dto.baseUnit,
            visibility: dto.visibility,
            imageUrl:
              dto.imageUrl === undefined ? undefined : dto.imageUrl || null,
          },
          include: foodDetailInclude,
        });
      });

      return this.toDto(food, normalizeLocale(locale), true);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Food translation already exists');
      }
      throw error;
    }
  }

  async listPrivateForModeration(
    actor: AuthUser,
    locale?: string,
  ): Promise<ModeratedFoodDto[]> {
    this.assertManager(actor);
    return this.listModerated(
      { visibility: FoodVisibility.PRIVATE },
      normalizeLocale(locale),
    );
  }

  async listOrphansForModeration(
    actor: AuthUser,
    locale?: string,
  ): Promise<ModeratedFoodDto[]> {
    this.assertManager(actor);
    const foods = await this.listModerated(
      { visibility: FoodVisibility.PRIVATE },
      normalizeLocale(locale),
    );
    return foods.filter((food) => food.references.total === 0);
  }

  async promote(
    id: string,
    actor: AuthUser,
    locale?: string,
  ): Promise<FoodDto> {
    this.assertManager(actor);
    const existing = await this.prisma.food.findUnique({
      where: { id },
      include: foodDetailInclude,
    });
    if (!existing) {
      throw new NotFoundException(`Food '${id}' not found`);
    }
    if (existing.visibility === FoodVisibility.PUBLIC) {
      return this.toDto(existing, normalizeLocale(locale), true);
    }

    const food = await this.prisma.food.update({
      where: { id },
      data: { visibility: FoodVisibility.PUBLIC },
      include: foodDetailInclude,
    });
    return this.toDto(food, normalizeLocale(locale), true);
  }

  async listNutrients(): Promise<NutrientDto[]> {
    const rows = await this.prisma.nutrient.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameEn: row.nameEn,
      nameVi: row.nameVi,
      unit: row.unit,
      group: row.group,
      sortOrder: row.sortOrder,
    }));
  }

  async replaceFoodNutrients(
    foodId: string,
    actor: AuthUser,
    dto: ReplaceFoodNutrientsDto,
    locale?: string,
  ): Promise<FoodDto> {
    this.assertManager(actor);
    const food = await this.prisma.food.findUnique({
      where: { id: foodId },
      include: foodDetailInclude,
    });
    if (!food) {
      throw new NotFoundException(`Food '${foodId}' not found`);
    }

    const codes = [...new Set(dto.nutrients.map((item) => item.code))];
    const nutrients = codes.length
      ? await this.prisma.nutrient.findMany({ where: { code: { in: codes } } })
      : [];
    const byCode = new Map(nutrients.map((row) => [row.code, row]));
    for (const code of codes) {
      if (!byCode.has(code)) {
        throw new BadRequestException(`Unknown nutrient code '${code}'`);
      }
    }

    const defaultBasis =
      food.measurementType === 'COUNT'
        ? { qty: 1, unit: Unit.PCS }
        : food.measurementType === 'VOLUME'
          ? { qty: 100, unit: Unit.ML }
          : { qty: 100, unit: Unit.G };

    await this.prisma.$transaction(async (tx) => {
      await tx.foodNutrient.deleteMany({ where: { foodId } });
      if (!dto.nutrients.length) return;
      await tx.foodNutrient.createMany({
        data: dto.nutrients.map((item) => ({
          foodId,
          nutrientId: byCode.get(item.code)!.id,
          amount: item.amount,
          basisQty: item.basisQty ?? defaultBasis.qty,
          basisUnit: item.basisUnit ?? defaultBasis.unit,
        })),
      });
    });

    const refreshed = await this.prisma.food.findUniqueOrThrow({
      where: { id: foodId },
      include: foodDetailInclude,
    });
    return this.toDto(refreshed, normalizeLocale(locale), true);
  }

  async merge(
    actor: AuthUser,
    dto: MergeFoodDto,
  ): Promise<MergeFoodResultDto> {
    this.assertManager(actor);

    if (dto.fromFoodId === dto.toFoodId) {
      throw new BadRequestException('fromFoodId and toFoodId must differ');
    }

    const [fromFood, toFood] = await Promise.all([
      this.prisma.food.findUnique({ where: { id: dto.fromFoodId } }),
      this.prisma.food.findUnique({ where: { id: dto.toFoodId } }),
    ]);
    if (!fromFood) {
      throw new NotFoundException(`fromFoodId '${dto.fromFoodId}' not found`);
    }
    if (!toFood) {
      throw new NotFoundException(`toFoodId '${dto.toFoodId}' not found`);
    }

    return this.prisma.$transaction((tx) =>
      this.mergeFoods(tx, dto.fromFoodId, dto.toFoodId),
    );
  }

  /**
   * Remap every reference of fromFoodId onto toFoodId, including revision snapshots.
   * toFood is promoted to PUBLIC when it was PRIVATE. fromFood is deleted.
   */
  async mergeFoods(
    tx: Prisma.TransactionClient,
    fromFoodId: string,
    toFoodId: string,
  ): Promise<MergeFoodResultDto> {
    if (fromFoodId === toFoodId) {
      throw new BadRequestException('fromFoodId and toFoodId must differ');
    }
    const toFood = await tx.food.findUnique({ where: { id: toFoodId } });
    if (!toFood) {
      throw new NotFoundException(`toFoodId '${toFoodId}' not found`);
    }
    const fromFood = await tx.food.findUnique({ where: { id: fromFoodId } });
    if (!fromFood) {
      throw new NotFoundException(`fromFoodId '${fromFoodId}' not found`);
    }

    const fromIngredients = await tx.recipeIngredient.findMany({
      where: { foodId: fromFoodId },
    });
    let remappedRecipeIngredients = 0;
    for (const ing of fromIngredients) {
      const conflict = await tx.recipeIngredient.findUnique({
        where: {
          recipeId_foodId: { recipeId: ing.recipeId, foodId: toFoodId },
        },
      });
      if (conflict) {
        await tx.recipeIngredient.update({
          where: { id: conflict.id },
          data: {
            quantity: conflict.quantity + ing.quantity,
            optional: conflict.optional && ing.optional,
          },
        });
        await tx.recipeIngredient.delete({ where: { id: ing.id } });
      } else {
        await tx.recipeIngredient.update({
          where: { id: ing.id },
          data: { foodId: toFoodId },
        });
      }
      remappedRecipeIngredients += 1;
    }

    await this.rewriteRevisionFoodIds(tx, fromFoodId, toFoodId);
    await this.mergeFoodNutrients(tx, fromFoodId, toFoodId);

    const inventory = await tx.inventoryItem.updateMany({
      where: { foodId: fromFoodId },
      data: { foodId: toFoodId },
    });
    const shopping = await tx.shoppingListItem.updateMany({
      where: { foodId: fromFoodId },
      data: { foodId: toFoodId },
    });

    const promotedToPublic = toFood.visibility !== FoodVisibility.PUBLIC;
    if (promotedToPublic) {
      await tx.food.update({
        where: { id: toFoodId },
        data: { visibility: FoodVisibility.PUBLIC },
      });
    }
    await tx.food.delete({ where: { id: fromFoodId } });

    return {
      fromFoodId,
      toFoodId,
      remappedRecipeIngredients,
      remappedInventoryItems: inventory.count,
      remappedShoppingListItems: shopping.count,
      deletedFromFood: true,
      promotedToPublic,
    };
  }

  async promoteFoods(
    tx: Prisma.TransactionClient,
    foodIds: string[],
  ): Promise<void> {
    if (!foodIds.length) return;
    await tx.food.updateMany({
      where: { id: { in: foodIds }, visibility: FoodVisibility.PRIVATE },
      data: { visibility: FoodVisibility.PUBLIC },
    });
  }

  async privateFoodsForReview(foodIds: string[]): Promise<
    Array<{
      foodId: string;
      name: string;
      slug: string;
      suggestions: Array<{
        id: string;
        name: string;
        slug: string;
        visibility: FoodVisibility;
      }>;
    }>
  > {
    const unique = [...new Set(foodIds)];
    if (!unique.length) return [];
    const foods = await this.prisma.food.findMany({
      where: { id: { in: unique }, visibility: FoodVisibility.PRIVATE },
      include: { translations: true },
    });
    const rows = [];
    for (const food of foods) {
      rows.push({
        foodId: food.id,
        name: pickTranslation(food.translations, 'vi')?.name ?? food.slug,
        slug: food.slug,
        suggestions: await this.suggestSimilar(food),
      });
    }
    return rows;
  }

  async deleteOrphan(id: string, actor: AuthUser) {
    this.assertManager(actor);
    const food = await this.prisma.food.findUnique({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Food '${id}' not found`);
    }
    if (food.visibility !== FoodVisibility.PRIVATE) {
      throw new BadRequestException(
        'Only PRIVATE orphan foods can be deleted this way',
      );
    }

    const counts = await this.countReferences(id);
    if (counts.total > 0) {
      throw new BadRequestException(
        `Food still has ${counts.total} references; merge instead of delete`,
      );
    }

    await this.prisma.food.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async mergeFoodNutrients(
    tx: Prisma.TransactionClient,
    fromFoodId: string,
    toFoodId: string,
  ): Promise<void> {
    const fromRows = await tx.foodNutrient.findMany({
      where: { foodId: fromFoodId },
    });
    for (const row of fromRows) {
      const existing = await tx.foodNutrient.findUnique({
        where: {
          foodId_nutrientId: {
            foodId: toFoodId,
            nutrientId: row.nutrientId,
          },
        },
      });
      if (existing) {
        await tx.foodNutrient.delete({ where: { id: row.id } });
      } else {
        await tx.foodNutrient.update({
          where: { id: row.id },
          data: { foodId: toFoodId },
        });
      }
    }
  }

  private async rewriteRevisionFoodIds(
    tx: Prisma.TransactionClient,
    fromFoodId: string,
    toFoodId: string,
  ): Promise<void> {
    const revisions = await tx.recipeRevision.findMany({
      where: { ingredientsJson: { string_contains: fromFoodId } },
      select: { id: true, ingredientsJson: true },
    });
    for (const revision of revisions) {
      const next = rewriteIngredientSnapshot(
        revision.ingredientsJson,
        fromFoodId,
        toFoodId,
      );
      if (!next) continue;
      await tx.recipeRevision.update({
        where: { id: revision.id },
        data: { ingredientsJson: next },
      });
    }
  }

  private async suggestSimilar(food: FoodWithTranslations): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      visibility: FoodVisibility;
    }>
  > {
    const needles = [
      ...food.translations.map((item) => item.name),
      food.slug.replace(/-/g, ' '),
    ]
      .map((value) => value.trim())
      .filter((value) => normalizeFoodName(value).length >= 3);
    if (!needles.length) return [];

    const or: Prisma.FoodWhereInput[] = [];
    for (const needle of needles.slice(0, 4)) {
      const slug = slugify(needle);
      if (slug.length >= 3) {
        or.push({ slug: { contains: slug, mode: 'insensitive' } });
        const parts = slug.split('-').filter((part) => part.length >= 3);
        if (parts.length >= 2) {
          or.push({
            slug: { contains: parts.slice(0, 2).join('-'), mode: 'insensitive' },
          });
        }
      }
      or.push({
        translations: {
          some: { name: { contains: needle, mode: 'insensitive' } },
        },
      });
    }

    const candidates = await this.prisma.food.findMany({
      where: { id: { not: food.id }, OR: or },
      include: { translations: true },
      take: 20,
    });

    const selfNames = needles.map((value) => normalizeFoodName(value));
    return candidates
      .filter((candidate) => {
        const names = [
          ...candidate.translations.map((item) => item.name),
          candidate.slug.replace(/-/g, ' '),
        ];
        return names.some((name) =>
          selfNames.some((needle) => namesOverlap(needle, normalizeFoodName(name))),
        );
      })
      .slice(0, 5)
      .map((candidate) => ({
        id: candidate.id,
        name:
          pickTranslation(candidate.translations, 'vi')?.name ?? candidate.slug,
        slug: candidate.slug,
        visibility: candidate.visibility,
      }));
  }

  private async listModerated(
    where: Prisma.FoodWhereInput,
    locale: string,
  ): Promise<ModeratedFoodDto[]> {
    const foods = await this.prisma.food.findMany({
      where,
      include: { translations: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const result: ModeratedFoodDto[] = [];
    for (const food of foods) {
      const references = await this.countReferences(food.id);
      result.push({
        ...this.toDto(food, locale),
        references,
      });
    }
    return result;
  }

  private async countReferences(
    foodId: string,
  ): Promise<FoodReferenceCountsDto> {
    const [recipeIngredients, inventoryItems, shoppingListItems] =
      await Promise.all([
        this.prisma.recipeIngredient.count({ where: { foodId } }),
        this.prisma.inventoryItem.count({ where: { foodId } }),
        this.prisma.shoppingListItem.count({ where: { foodId } }),
      ]);
    return {
      recipeIngredients,
      inventoryItems,
      shoppingListItems,
      total: recipeIngredients + inventoryItems + shoppingListItems,
    };
  }

  private assertManager(actor: AuthUser) {
    if (!this.canManageCatalog(actor)) {
      throw new ForbiddenException('Catalog moderation permission required');
    }
  }

  private visibilityFilter(viewer?: AuthUser): Prisma.FoodWhereInput {
    if (viewer && this.canManageCatalog(viewer)) {
      return {};
    }
    if (viewer) {
      return {
        OR: [
          { visibility: FoodVisibility.PUBLIC },
          {
            visibility: FoodVisibility.PRIVATE,
            createdByUserId: viewer.id,
          },
        ],
      };
    }
    return { visibility: FoodVisibility.PUBLIC };
  }

  private assertCanView(
    food: { visibility: FoodVisibility; createdByUserId: string | null },
    viewer?: AuthUser,
  ) {
    if (food.visibility === FoodVisibility.PUBLIC) {
      return;
    }
    if (viewer && this.canManageCatalog(viewer)) {
      return;
    }
    if (viewer && food.createdByUserId === viewer.id) {
      return;
    }
    throw new NotFoundException(`Food not found`);
  }

  private canManageCatalog(user: AuthUser): boolean {
    return (
      user.permissions.includes(Permission.CATALOG_MANAGE) ||
      user.permissions.includes(Permission.MODERATION) ||
      user.permissions.includes(Permission.SYSTEM_MANAGE)
    );
  }

  private normalizeTranslations(
    translations: UpsertFoodTranslationDto[],
  ): Array<{ locale: string; name: string; category?: string | null }> {
    if (!translations?.length) {
      throw new BadRequestException('At least one translation is required');
    }

    const map = new Map<
      string,
      { locale: string; name: string; category?: string | null }
    >();

    for (const item of translations) {
      const locale = item.locale.toLowerCase().trim();
      if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
        throw new BadRequestException(
          `Unsupported locale '${item.locale}'. Supported: ${SUPPORTED_LOCALES.join(', ')}`,
        );
      }
      map.set(locale, {
        locale,
        name: item.name.trim(),
        category: item.category?.trim() || null,
      });
    }

    return [...map.values()];
  }

  private toDto(
    food: FoodWithTranslations,
    locale: string,
    withNutrients = false,
  ): FoodDto {
    const translation = pickTranslation(food.translations, locale);
    if (!translation) {
      throw new NotFoundException(
        `Food '${food.slug}' has no translations`,
      );
    }

    return {
      id: food.id,
      slug: food.slug,
      name: translation.name,
      category: translation.category,
      locale: translation.locale,
      measurementType: food.measurementType,
      baseUnit: food.baseUnit,
      visibility: food.visibility,
      createdByUserId: food.createdByUserId,
      imageUrl: food.imageUrl,
      translations: food.translations.map((item) => ({
        locale: item.locale,
        name: item.name,
        category: item.category,
      })),
      ...(withNutrients
        ? { nutrients: mapFoodNutrients(food.nutrients ?? []) }
        : {}),
      createdAt: food.createdAt,
      updatedAt: food.updatedAt,
    };
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = base || 'food';
    let candidate = root;
    let i = 2;

    while (true) {
      const found = await this.prisma.food.findUnique({
        where: { slug: candidate },
      });
      if (!found || found.id === excludeId) {
        return candidate;
      }
      candidate = `${root}-${i}`;
      i += 1;
    }
  }
}
