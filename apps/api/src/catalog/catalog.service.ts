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
  UpdateFoodDto,
  UpsertFoodTranslationDto,
} from './dto/food.dto';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type FoodWithTranslations = Prisma.FoodGetPayload<{
  include: { translations: true };
}>;

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
      include: { translations: true },
      orderBy: { slug: 'asc' },
      take: 100,
    });

    return foods
      .map((food) => this.toDto(food, locale))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }

  async findBySlug(
    slug: string,
    locale?: string,
    viewer?: AuthUser,
  ): Promise<FoodDto> {
    const food = await this.prisma.food.findUnique({
      where: { slug },
      include: { translations: true },
    });
    if (!food) {
      throw new NotFoundException(`Food '${slug}' not found`);
    }
    this.assertCanView(food, viewer);
    return this.toDto(food, normalizeLocale(locale));
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
        include: { translations: true },
      });
      return this.toDto(food, normalizeLocale(locale));
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
          include: { translations: true },
        });
      });

      return this.toDto(food, normalizeLocale(locale));
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

  private toDto(food: FoodWithTranslations, locale: string): FoodDto {
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
