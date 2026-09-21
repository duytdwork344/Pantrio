import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionType,
  QuantityConfidence,
  ShoppingListItemStatus,
  StorageLocation,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertFoodsUsable } from '../common/foods/assert-food-usable';
import { pickTranslation } from '../common/i18n/locale';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  GenerateShoppingListDto,
  MergeShoppingListsDto,
  PurchaseShoppingItemDto,
  ShoppingListDetailDto,
  ShoppingListItemDto,
  ShoppingListSummaryDto,
  UpdateShoppingListDto,
  UpdateShoppingListItemDto,
} from './dto/shopping.dto';

type NeedKey = string; // `${foodId}::${unit}`

@Injectable()
export class ShoppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  async listForUser(
    userId: string,
    groupId?: string,
  ): Promise<ShoppingListSummaryDto[]> {
    if (groupId) {
      await this.groups.requireMembership(userId, groupId);
    }

    const lists = await this.prisma.shoppingList.findMany({
      where: groupId
        ? { groupId }
        : { userId, groupId: null },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    });

    return lists.map((list) => this.toSummary(list));
  }

  async getDetail(userId: string, id: string): Promise<ShoppingListDetailDto> {
    const list = await this.getAccessibleList(userId, id);
    return this.toDetail(list);
  }

  async create(
    userId: string,
    dto: CreateShoppingListDto,
  ): Promise<ShoppingListDetailDto> {
    let groupId: string | null = null;
    if (dto.groupId) {
      await this.groups.requireMembership(userId, dto.groupId);
      groupId = dto.groupId;
    }

    const list = await this.prisma.shoppingList.create({
      data: {
        userId,
        groupId,
        name: dto.name?.trim() || 'Shopping List',
      },
      include: {
        items: {
          include: { food: { include: { translations: true } } },
        },
      },
    });
    return this.toDetail(list);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateShoppingListDto,
  ): Promise<ShoppingListDetailDto> {
    await this.assertListAccessible(userId, id);
    const list = await this.prisma.shoppingList.update({
      where: { id },
      data: { name: dto.name.trim() },
      include: {
        items: {
          include: { food: { include: { translations: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return this.toDetail(list);
  }

  /**
   * Create a new list by copying items from existing lists.
   * Aggregates by foodId+unit; new items are always PENDING.
   * SKIPPED source items are ignored. Sources are left unchanged.
   * Sources must share the same scope (all personal or same groupId).
   */
  async mergeFromLists(
    userId: string,
    dto: MergeShoppingListsDto,
  ): Promise<ShoppingListDetailDto> {
    const sourceIds = [...new Set(dto.sourceListIds.map((id) => id.trim()))];
    if (sourceIds.length === 0) {
      throw new BadRequestException('sourceListIds must not be empty');
    }

    const sources = await this.prisma.shoppingList.findMany({
      where: { id: { in: sourceIds } },
      include: { items: true },
    });
    if (sources.length !== sourceIds.length) {
      throw new BadRequestException(
        'One or more sourceListIds were not found',
      );
    }

    for (const source of sources) {
      await this.assertListAccessible(userId, source.id, source);
    }

    const scopeGroupId = sources[0]!.groupId;
    if (sources.some((s) => s.groupId !== scopeGroupId)) {
      throw new BadRequestException(
        'Cannot merge lists across personal and group scopes (or different groups)',
      );
    }
    if (scopeGroupId) {
      await this.groups.requireMembership(userId, scopeGroupId);
    }

    type Acc = {
      foodId: string;
      unit: string;
      quantity: number;
      recipeId: string | null;
      note: string | null;
    };
    const merged = new Map<NeedKey, Acc>();

    for (const source of sources) {
      for (const item of source.items) {
        if (item.status === ShoppingListItemStatus.SKIPPED) {
          continue;
        }
        const unit = item.unit.trim();
        const key = `${item.foodId}::${unit.toLowerCase()}`;
        const existing = merged.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          if (!existing.recipeId && item.recipeId) {
            existing.recipeId = item.recipeId;
          }
          if (!existing.note && item.note) {
            existing.note = item.note;
          }
        } else {
          merged.set(key, {
            foodId: item.foodId,
            unit,
            quantity: item.quantity,
            recipeId: item.recipeId,
            note: item.note,
          });
        }
      }
    }

    const targetGroupId = dto.groupId ?? scopeGroupId ?? null;
    if (targetGroupId) {
      await this.groups.requireMembership(userId, targetGroupId);
    }

    const list = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shoppingList.create({
        data: {
          userId,
          groupId: targetGroupId,
          name: dto.name.trim(),
          items: {
            create: [...merged.values()].map((row) => ({
              foodId: row.foodId,
              unit: row.unit,
              quantity: Number(row.quantity.toFixed(3)),
              recipeId: row.recipeId,
              note: row.note,
              status: ShoppingListItemStatus.PENDING,
            })),
          },
        },
        include: {
          items: {
            include: { food: { include: { translations: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      return created;
    });

    return this.toDetail(list);
  }

  /** Reset PURCHASED / SKIPPED items to PENDING for reuse. Does not touch Inventory. */
  async reset(userId: string, id: string): Promise<ShoppingListDetailDto> {
    await this.assertListAccessible(userId, id);
    await this.prisma.shoppingListItem.updateMany({
      where: {
        shoppingListId: id,
        status: {
          in: [
            ShoppingListItemStatus.PURCHASED,
            ShoppingListItemStatus.SKIPPED,
          ],
        },
      },
      data: { status: ShoppingListItemStatus.PENDING },
    });
    return this.getDetail(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    await this.assertListAccessible(userId, id);
    await this.prisma.shoppingList.delete({ where: { id } });
    return { deleted: true };
  }

  async addItem(
    user: AuthUser,
    listId: string,
    dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    await this.assertListAccessible(user.id, listId);
    await assertFoodsUsable(this.prisma, [dto.foodId], user);

    const food = await this.prisma.food.findUnique({
      where: { id: dto.foodId },
      include: { translations: true },
    });
    if (!food) {
      throw new BadRequestException(`Unknown foodId '${dto.foodId}'`);
    }

    if (dto.recipeId) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: dto.recipeId },
        select: { id: true },
      });
      if (!recipe) {
        throw new BadRequestException(`Unknown recipeId '${dto.recipeId}'`);
      }
    }

    const item = await this.prisma.shoppingListItem.create({
      data: {
        shoppingListId: listId,
        foodId: dto.foodId,
        quantity: dto.quantity,
        unit: dto.unit.trim(),
        recipeId: dto.recipeId ?? null,
        note: dto.note?.trim() || null,
      },
      include: { food: { include: { translations: true } } },
    });

    return this.toItemDto(item);
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    const item = await this.getAccessibleItem(userId, listId, itemId);
    const updated = await this.prisma.shoppingListItem.update({
      where: { id: item.id },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
      },
      include: { food: { include: { translations: true } } },
    });
    return this.toItemDto(updated);
  }

  async generateFromPlanned(
    userId: string,
    listId: string,
    dto: GenerateShoppingListDto,
  ): Promise<ShoppingListDetailDto> {
    const listMeta = await this.assertListAccessible(userId, listId);

    const planned = await this.prisma.plannedRecipe.findMany({
      where: {
        userId,
        ...(dto.plannedRecipeIds?.length
          ? { id: { in: dto.plannedRecipeIds } }
          : {}),
      },
      include: {
        recipe: {
          include: { ingredients: true },
        },
      },
    });

    if (dto.plannedRecipeIds?.length && planned.length !== dto.plannedRecipeIds.length) {
      throw new BadRequestException(
        'One or more plannedRecipeIds were not found for this user',
      );
    }
    if (!planned.length) {
      throw new BadRequestException('No planned recipes to generate from');
    }

    const needs = new Map<
      NeedKey,
      { foodId: string; unit: string; quantity: number; recipeId: string }
    >();

    for (const plan of planned) {
      const scale = plan.servings / Math.max(plan.recipe.servings, 1);
      for (const ing of plan.recipe.ingredients) {
        const unit = ing.unit.trim().toLowerCase();
        const key = `${ing.foodId}::${unit}`;
        const scaled = ing.quantity * scale;
        const existing = needs.get(key);
        if (existing) {
          existing.quantity += scaled;
        } else {
          needs.set(key, {
            foodId: ing.foodId,
            unit: ing.unit.trim(),
            quantity: scaled,
            recipeId: plan.recipeId,
          });
        }
      }
    }

    // Shortage against pantry of the same scope as the shopping list.
    const inventory = await this.prisma.inventoryItem.findMany({
      where: listMeta.groupId
        ? { groupId: listMeta.groupId }
        : { userId, groupId: null },
      select: { foodId: true, quantity: true, unit: true },
    });
    const have = new Map<NeedKey, number>();
    for (const row of inventory) {
      const key = `${row.foodId}::${row.unit.trim().toLowerCase()}`;
      have.set(key, (have.get(key) ?? 0) + row.quantity);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [key, need] of needs) {
        const available = have.get(key) ?? 0;
        const shortage = Math.max(0, need.quantity - available);
        if (shortage <= 0) {
          continue;
        }

        const existing = await tx.shoppingListItem.findFirst({
          where: {
            shoppingListId: listId,
            foodId: need.foodId,
            unit: { equals: need.unit, mode: 'insensitive' },
            status: ShoppingListItemStatus.PENDING,
          },
        });

        if (existing) {
          await tx.shoppingListItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + shortage,
              recipeId: existing.recipeId ?? need.recipeId,
            },
          });
        } else {
          await tx.shoppingListItem.create({
            data: {
              shoppingListId: listId,
              foodId: need.foodId,
              unit: need.unit,
              quantity: Number(shortage.toFixed(3)),
              recipeId: need.recipeId,
              status: ShoppingListItemStatus.PENDING,
            },
          });
        }
      }
    });

    return this.getDetail(userId, listId);
  }

  async purchaseItem(
    userId: string,
    listId: string,
    itemId: string,
    dto: PurchaseShoppingItemDto,
  ) {
    const listMeta = await this.assertListAccessible(userId, listId);
    const item = await this.getAccessibleItem(userId, listId, itemId);

    const quantity = dto.quantity ?? item.quantity;
    const unit = (dto.unit ?? item.unit).trim();

    const result = await this.prisma.$transaction(async (tx) => {
      // Atomic claim — only one concurrent purchase wins.
      const claimed = await tx.shoppingListItem.updateMany({
        where: {
          id: item.id,
          status: ShoppingListItemStatus.PENDING,
        },
        data: { status: ShoppingListItemStatus.PURCHASED },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Item already purchased');
      }

      const updatedItem = await tx.shoppingListItem.findUniqueOrThrow({
        where: { id: item.id },
        include: { food: { include: { translations: true } } },
      });

      const inventoryItem = await tx.inventoryItem.create({
        data: {
          userId,
          groupId: listMeta.groupId,
          foodId: item.foodId,
          quantity,
          unit,
          confidence: QuantityConfidence.EXACT,
          purchaseDate: dto.purchaseDate
            ? new Date(dto.purchaseDate)
            : new Date(),
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          storageLocation: dto.storageLocation ?? StorageLocation.PANTRY,
        },
        include: { food: { include: { translations: true } } },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryItem.id,
          userId,
          type: InventoryTransactionType.PURCHASE,
          quantity,
          unit,
          recipeId: item.recipeId,
          estimated: false,
          note: 'From shopping list',
        },
      });

      return { item: updatedItem, inventoryItem };
    });

    const translation = pickTranslation(
      result.inventoryItem.food.translations,
    );

    return {
      shoppingItem: this.toItemDto(result.item),
      inventoryItem: {
        id: result.inventoryItem.id,
        foodId: result.inventoryItem.foodId,
        foodName: translation?.name ?? result.inventoryItem.food.slug,
        groupId: result.inventoryItem.groupId,
        quantity: result.inventoryItem.quantity,
        unit: result.inventoryItem.unit,
        storageLocation: result.inventoryItem.storageLocation,
      },
    };
  }

  private async getAccessibleList(userId: string, id: string) {
    const list = await this.prisma.shoppingList.findUnique({
      where: { id },
      include: {
        items: {
          include: { food: { include: { translations: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Shopping list '${id}' not found`);
    }
    await this.assertListAccessible(userId, id, list);
    return list;
  }

  private async assertListAccessible(
    userId: string,
    id: string,
    preloaded?: { id: string; userId: string; groupId: string | null },
  ) {
    const list =
      preloaded ??
      (await this.prisma.shoppingList.findUnique({
        where: { id },
        select: { id: true, userId: true, groupId: true },
      }));
    if (!list) {
      throw new NotFoundException(`Shopping list '${id}' not found`);
    }
    if (list.groupId) {
      await this.groups.requireMembership(userId, list.groupId);
    } else if (list.userId !== userId) {
      throw new NotFoundException(`Shopping list '${id}' not found`);
    }
    return list;
  }

  private async getAccessibleItem(userId: string, listId: string, itemId: string) {
    const list = await this.assertListAccessible(userId, listId);
    const item = await this.prisma.shoppingListItem.findUnique({
      where: { id: itemId },
      include: { food: { include: { translations: true } } },
    });
    if (!item || item.shoppingListId !== list.id) {
      throw new NotFoundException(`Shopping item '${itemId}' not found`);
    }
    return item;
  }

  private toSummary(list: {
    id: string;
    name: string;
    groupId?: string | null;
    items: Array<{ status: ShoppingListItemStatus }>;
  }): ShoppingListSummaryDto {
    return {
      id: list.id,
      name: list.name,
      groupId: list.groupId ?? null,
      itemCount: list.items.length,
      pendingCount: list.items.filter(
        (item) => item.status === ShoppingListItemStatus.PENDING,
      ).length,
    };
  }

  private toDetail(list: {
    id: string;
    name: string;
    groupId?: string | null;
    items: Array<{
      id: string;
      foodId: string;
      recipeId: string | null;
      quantity: number;
      unit: string;
      status: ShoppingListItemStatus;
      note: string | null;
      food: {
        slug: string;
        translations: Array<{
          locale: string;
          name: string;
          category: string | null;
        }>;
      };
    }>;
  }): ShoppingListDetailDto {
    return {
      ...this.toSummary(list),
      items: list.items.map((item) => this.toItemDto(item)),
    };
  }

  private toItemDto(item: {
    id: string;
    foodId: string;
    recipeId: string | null;
    quantity: number;
    unit: string;
    status: ShoppingListItemStatus;
    note: string | null;
    food: {
      slug: string;
      translations: Array<{
        locale: string;
        name: string;
        category: string | null;
      }>;
    };
  }): ShoppingListItemDto {
    const translation = pickTranslation(item.food.translations);
    return {
      id: item.id,
      foodId: item.foodId,
      foodName: translation?.name ?? item.food.slug,
      recipeId: item.recipeId,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status,
      note: item.note,
    };
  }
}
