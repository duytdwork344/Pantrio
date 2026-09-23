import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryTransactionType, Prisma } from '@prisma/client';
import { pickTranslation } from '../common/i18n/locale';
import {
  fromBaseQuantity,
  sameFamily,
  toBaseQuantity,
} from '../common/units/convert';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConsumptionLineDto,
  CookRecipeDto,
  CookingSessionDto,
  RecommendationItemDto,
} from './dto/cooking.dto';

type PantryScope = { userId: string; groupId: string | null } | { groupId: string };

@Injectable()
export class CookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  async cook(userId: string, dto: CookRecipeDto): Promise<CookingSessionDto> {
    const pantryWhere = await this.resolvePantryWhere(userId, dto.groupId);

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipeId },
      include: {
        ingredients: {
          include: { food: { include: { translations: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe '${dto.recipeId}' not found`);
    }

    const scale = dto.servings / Math.max(recipe.servings, 1);
    const consumptions: ConsumptionLineDto[] = [];

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cookingSession.create({
        data: {
          userId,
          recipeId: recipe.id,
          servings: dto.servings,
          notes: dto.notes?.trim() || null,
        },
      });

      for (const ing of recipe.ingredients) {
        if (ing.optional) {
          continue;
        }

        const needed = ing.quantity * scale;
        const neededBase = toBaseQuantity(needed, ing.unit);
        if (!neededBase) {
          throw new BadRequestException(
            `Unsupported unit '${ing.unit}' on ingredient ${ing.foodId}`,
          );
        }

        const batches = await tx.inventoryItem.findMany({
          where: {
            ...pantryWhere,
            foodId: ing.foodId,
            quantity: { gt: 0 },
          },
          orderBy: [
            { expiryDate: { sort: 'asc', nulls: 'last' } },
            { createdAt: 'asc' },
          ],
        });

        const compatible = batches.filter((batch) =>
          sameFamily(batch.unit, ing.unit),
        );

        let remaining = neededBase.base;
        const batchIds: string[] = [];
        let consumedInIngredientUnit = 0;

        for (const batch of compatible) {
          if (remaining <= 0) {
            break;
          }
          const batchBase = toBaseQuantity(batch.quantity, batch.unit);
          if (!batchBase || batchBase.family !== neededBase.family) {
            continue;
          }

          const takeBase = Math.min(remaining, batchBase.base);
          const takeInBatchUnit = fromBaseQuantity(takeBase, batch.unit);
          if (takeInBatchUnit === null || takeInBatchUnit <= 0) {
            continue;
          }

          // Atomic claim: skip batch if another cook already reduced quantity.
          const claimed = await tx.inventoryItem.updateMany({
            where: {
              id: batch.id,
              quantity: { gte: takeInBatchUnit },
            },
            data: {
              quantity: { decrement: takeInBatchUnit },
            },
          });
          if (claimed.count === 0) {
            continue;
          }

          await tx.inventoryTransaction.create({
            data: {
              inventoryItemId: batch.id,
              userId,
              type: InventoryTransactionType.ESTIMATED_CONSUME,
              quantity: takeInBatchUnit,
              unit: batch.unit,
              recipeId: recipe.id,
              cookingSessionId: created.id,
              estimated: true,
              note: `Cook ${recipe.slug} × ${dto.servings}${
                dto.groupId ? ' (group pantry)' : ''
              }`,
            },
          });

          batchIds.push(batch.id);
          remaining -= takeBase;
          const takeInNeededUnit = fromBaseQuantity(takeBase, ing.unit) ?? 0;
          consumedInIngredientUnit += takeInNeededUnit;
        }

        const translation = pickTranslation(ing.food.translations);
        consumptions.push({
          foodId: ing.foodId,
          foodName: translation?.name ?? ing.food.slug,
          neededQuantity: Number(needed.toFixed(3)),
          neededUnit: ing.unit,
          consumedQuantity: Number(consumedInIngredientUnit.toFixed(3)),
          consumedUnit: ing.unit,
          shortfallQuantity: Number(
            Math.max(0, needed - consumedInIngredientUnit).toFixed(3),
          ),
          batchIds,
        });
      }

      return tx.cookingSession.update({
        where: { id: created.id },
        data: {
          consumptionsJson: consumptions as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return {
      id: session.id,
      recipeId: session.recipeId,
      servings: session.servings,
      cookedAt: session.cookedAt,
      notes: session.notes,
      recipe: {
        id: recipe.id,
        title: recipe.title,
        slug: recipe.slug,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMin: recipe.prepTimeMin,
        cookTimeMin: recipe.cookTimeMin,
        difficulty: recipe.difficulty,
        imageUrl: recipe.imageUrl,
      },
      consumptions,
    };
  }

  async listSessions(userId: string): Promise<CookingSessionDto[]> {
    const sessions = await this.prisma.cookingSession.findMany({
      where: { userId },
      include: {
        recipe: true,
        transactions: {
          include: {
            inventoryItem: {
              include: { food: { include: { translations: true } } },
            },
          },
        },
      },
      orderBy: { cookedAt: 'desc' },
      take: 50,
    });

    return sessions.map((session) => this.sessionToDto(session));
  }

  async getSession(userId: string, id: string): Promise<CookingSessionDto> {
    const session = await this.prisma.cookingSession.findFirst({
      where: { id, userId },
      include: {
        recipe: true,
        transactions: {
          include: {
            inventoryItem: {
              include: { food: { include: { translations: true } } },
            },
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundException(`Cooking session '${id}' not found`);
    }
    return this.sessionToDto(session);
  }

  async undo(userId: string, id: string) {
    const session = await this.prisma.cookingSession.findFirst({
      where: { id, userId },
      include: {
        transactions: {
          where: { type: InventoryTransactionType.ESTIMATED_CONSUME },
        },
      },
    });
    if (!session) {
      throw new NotFoundException(`Cooking session '${id}' not found`);
    }
    if (!session.transactions.length) {
      throw new BadRequestException('Session has no consumptions to undo');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const txn of session.transactions) {
        const batch = await tx.inventoryItem.findUnique({
          where: { id: txn.inventoryItemId },
        });
        if (!batch) {
          continue;
        }

        await tx.inventoryItem.update({
          where: { id: batch.id },
          data: {
            quantity: Number((batch.quantity + txn.quantity).toFixed(6)),
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: batch.id,
            userId,
            type: InventoryTransactionType.ADJUSTMENT,
            quantity: txn.quantity,
            unit: txn.unit,
            recipeId: session.recipeId,
            estimated: false,
            note: `Undo cook session ${session.id}`,
          },
        });
      }

      await tx.inventoryTransaction.deleteMany({
        where: { cookingSessionId: session.id },
      });

      await tx.cookingSession.delete({ where: { id: session.id } });
    });

    return { undone: true, id };
  }

  async recommend(
    userId: string,
    groupId?: string,
  ): Promise<RecommendationItemDto[]> {
    const pantryWhere = await this.resolvePantryWhere(userId, groupId);

    const [recipes, inventory] = await Promise.all([
      this.prisma.recipe.findMany({
        where: groupId
          ? {
              OR: [
                { visibility: 'PUBLIC', groupId: null },
                { visibility: 'GROUP', groupId },
              ],
            }
          : { visibility: 'PUBLIC', groupId: null },
        include: {
          ingredients: {
            include: { food: { include: { translations: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.inventoryItem.findMany({
        where: { ...pantryWhere, quantity: { gt: 0 } },
        select: { foodId: true, quantity: true, unit: true },
      }),
    ]);

    const stock = inventory
      .map((row) => {
        const converted = toBaseQuantity(row.quantity, row.unit);
        if (!converted) {
          return null;
        }
        return { foodId: row.foodId, ...converted };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null && row.base > 0);

    const results: RecommendationItemDto[] = [];

    for (const recipe of recipes) {
      const required = recipe.ingredients.filter((ing) => !ing.optional);
      const missing: RecommendationItemDto['missing'] = [];
      let matchedCount = 0;

      for (const ing of required) {
        const need = toBaseQuantity(ing.quantity, ing.unit);
        if (!need) {
          missing.push({
            foodId: ing.foodId,
            foodName:
              pickTranslation(ing.food.translations)?.name ?? ing.food.slug,
            quantity: ing.quantity,
            unit: ing.unit,
          });
          continue;
        }

        const available = stock
          .filter(
            (row) => row.foodId === ing.foodId && row.family === need.family,
          )
          .reduce((sum, row) => sum + row.base, 0);

        if (available + 1e-9 >= need.base) {
          matchedCount += 1;
        } else {
          const shortfallBase = Math.max(0, need.base - available);
          const shortfall =
            fromBaseQuantity(shortfallBase, ing.unit) ?? shortfallBase;
          missing.push({
            foodId: ing.foodId,
            foodName:
              pickTranslation(ing.food.translations)?.name ?? ing.food.slug,
            quantity: Number(shortfall.toFixed(3)),
            unit: ing.unit,
          });
        }
      }

      results.push({
        recipe: {
          id: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
          description: recipe.description,
          servings: recipe.servings,
          prepTimeMin: recipe.prepTimeMin,
          cookTimeMin: recipe.cookTimeMin,
          difficulty: recipe.difficulty,
          imageUrl: recipe.imageUrl,
        },
        requiredCount: required.length,
        matchedCount,
        missingCount: missing.length,
        canCook: missing.length === 0 && required.length > 0,
        missing,
      });
    }

    return results.sort((a, b) => {
      if (a.canCook !== b.canCook) {
        return a.canCook ? -1 : 1;
      }
      const aRatio = a.requiredCount
        ? a.matchedCount / a.requiredCount
        : 0;
      const bRatio = b.requiredCount
        ? b.matchedCount / b.requiredCount
        : 0;
      return bRatio - aRatio;
    });
  }

  /** Personal pantry = userId + groupId null; group = membership + groupId. */
  private async resolvePantryWhere(
    userId: string,
    groupId?: string,
  ): Promise<PantryScope> {
    if (groupId) {
      await this.groups.requireMembership(userId, groupId);
      return { groupId };
    }
    return { userId, groupId: null };
  }

  private sessionToDto(session: {
    id: string;
    recipeId: string;
    servings: number;
    cookedAt: Date;
    notes: string | null;
    consumptionsJson?: unknown;
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
    transactions: Array<{
      quantity: number;
      unit: string;
      inventoryItem: {
        foodId: string;
        food: {
          slug: string;
          translations: Array<{
            locale: string;
            name: string;
            category: string | null;
          }>;
        };
      };
    }>;
  }): CookingSessionDto {
    const recipeSummary = {
      id: session.recipe.id,
      title: session.recipe.title,
      slug: session.recipe.slug,
      description: session.recipe.description,
      servings: session.recipe.servings,
      prepTimeMin: session.recipe.prepTimeMin,
      cookTimeMin: session.recipe.cookTimeMin,
      difficulty: session.recipe.difficulty,
      imageUrl: session.recipe.imageUrl,
    };

    const fromSnapshot = this.parseConsumptionsSnapshot(session.consumptionsJson);
    if (fromSnapshot) {
      return {
        id: session.id,
        recipeId: session.recipeId,
        servings: session.servings,
        cookedAt: session.cookedAt,
        notes: session.notes,
        recipe: recipeSummary,
        consumptions: fromSnapshot,
      };
    }

    const byFood = new Map<string, ConsumptionLineDto>();
    for (const txn of session.transactions) {
      const foodId = txn.inventoryItem.foodId;
      const translation = pickTranslation(txn.inventoryItem.food.translations);
      const existing = byFood.get(foodId);
      if (existing) {
        existing.consumedQuantity = Number(
          (existing.consumedQuantity + txn.quantity).toFixed(3),
        );
      } else {
        byFood.set(foodId, {
          foodId,
          foodName: translation?.name ?? txn.inventoryItem.food.slug,
          neededQuantity: 0,
          neededUnit: txn.unit,
          consumedQuantity: txn.quantity,
          consumedUnit: txn.unit,
          shortfallQuantity: 0,
          batchIds: [],
        });
      }
    }

    return {
      id: session.id,
      recipeId: session.recipeId,
      servings: session.servings,
      cookedAt: session.cookedAt,
      notes: session.notes,
      recipe: recipeSummary,
      consumptions: [...byFood.values()],
    };
  }

  private parseConsumptionsSnapshot(
    value: unknown,
  ): ConsumptionLineDto[] | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }
    return value as ConsumptionLineDto[];
  }
}
