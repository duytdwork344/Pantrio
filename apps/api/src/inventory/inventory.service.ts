import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionType,
  QuantityConfidence,
  StorageLocation,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertFoodsUsable } from '../common/foods/assert-food-usable';
import { pickTranslation } from '../common/i18n/locale';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInventoryItemDto,
  InventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  async list(
    user: AuthUser,
    groupId?: string,
  ): Promise<InventoryItemDto[]> {
    if (groupId) {
      await this.groups.requireMembership(user.id, groupId);
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: groupId
        ? { groupId }
        : { userId: user.id, groupId: null },
      include: {
        food: {
          include: { translations: true },
        },
      },
      orderBy: [{ expiryDate: 'asc' }, { updatedAt: 'desc' }],
    });

    return items.map((item) => this.toDto(item));
  }

  async create(
    user: AuthUser,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    await assertFoodsUsable(this.prisma, [dto.foodId], user);

    let groupId: string | null = null;
    if (dto.groupId) {
      await this.groups.requireMembership(user.id, dto.groupId);
      groupId = dto.groupId;
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          userId: user.id,
          groupId,
          foodId: dto.foodId,
          quantity: dto.quantity,
          unit: dto.unit.trim(),
          confidence: dto.confidence ?? QuantityConfidence.APPROXIMATE,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          purchaseDate: dto.purchaseDate
            ? new Date(dto.purchaseDate)
            : new Date(),
          storageLocation: dto.storageLocation ?? StorageLocation.PANTRY,
          opened: dto.opened ?? false,
          notes: dto.notes?.trim() || null,
        },
        include: {
          food: { include: { translations: true } },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: created.id,
          userId: user.id,
          type: InventoryTransactionType.PURCHASE,
          quantity: dto.quantity,
          unit: created.unit,
          estimated: false,
        },
      });

      return created;
    });

    return this.toDto(item);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const existing = await this.assertAccessible(user.id, id);

    const nextUnit = dto.unit?.trim();
    const unitChanged =
      nextUnit !== undefined && nextUnit !== existing.unit;
    const quantityChanged =
      dto.quantity !== undefined && dto.quantity !== existing.quantity;

    const item = await this.prisma.$transaction(async (tx) => {
      if (quantityChanged || unitChanged) {
        const delta = quantityChanged
          ? (dto.quantity as number) - existing.quantity
          : 0;
        const noteParts: string[] = [];
        if (quantityChanged) {
          noteParts.push('Manual quantity update');
        }
        if (unitChanged) {
          noteParts.push(`Unit ${existing.unit} → ${nextUnit}`);
        }

        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: id,
            userId: user.id,
            type: InventoryTransactionType.ADJUSTMENT,
            quantity: delta,
            unit: nextUnit ?? existing.unit,
            note: noteParts.join('; '),
            estimated: false,
          },
        });
      }

      return tx.inventoryItem.update({
        where: { id },
        data: {
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(nextUnit !== undefined ? { unit: nextUnit } : {}),
          ...(dto.confidence !== undefined
            ? { confidence: dto.confidence }
            : {}),
          ...(dto.expiryDate !== undefined
            ? {
                expiryDate:
                  dto.expiryDate === null ? null : new Date(dto.expiryDate),
              }
            : {}),
          ...(dto.purchaseDate !== undefined
            ? {
                purchaseDate:
                  dto.purchaseDate === null
                    ? null
                    : new Date(dto.purchaseDate),
              }
            : {}),
          ...(dto.storageLocation !== undefined
            ? { storageLocation: dto.storageLocation }
            : {}),
          ...(dto.opened !== undefined ? { opened: dto.opened } : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
        },
        include: {
          food: { include: { translations: true } },
        },
      });
    });

    return this.toDto(item);
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.assertAccessible(user.id, id);

    await this.prisma.$transaction(async (tx) => {
      if (existing.quantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: id,
            userId: user.id,
            type: InventoryTransactionType.DISPOSE,
            quantity: existing.quantity,
            unit: existing.unit,
            note: 'Batch removed from inventory',
            estimated: false,
          },
        });
      }

      await tx.inventoryItem.delete({ where: { id } });
    });

    return { deleted: true, id };
  }

  private async assertAccessible(userId: string, id: string) {
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Inventory item '${id}' not found`);
    }
    if (existing.groupId) {
      await this.groups.requireMembership(userId, existing.groupId);
      return existing;
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Not your inventory item');
    }
    return existing;
  }

  private toDto(item: {
    id: string;
    foodId: string;
    groupId?: string | null;
    quantity: number;
    unit: string;
    confidence: QuantityConfidence;
    expiryDate: Date | null;
    purchaseDate: Date | null;
    storageLocation: StorageLocation;
    opened: boolean;
    notes: string | null;
    food: {
      slug: string;
      translations: Array<{ locale: string; name: string; category: string | null }>;
    };
  }): InventoryItemDto {
    const translation = pickTranslation(item.food.translations);
    return {
      id: item.id,
      foodId: item.foodId,
      foodName: translation?.name ?? item.food.slug,
      groupId: item.groupId ?? null,
      quantity: item.quantity,
      unit: item.unit,
      confidence: item.confidence,
      expiryDate: item.expiryDate?.toISOString() ?? null,
      purchaseDate: item.purchaseDate?.toISOString() ?? null,
      storageLocation: item.storageLocation,
      opened: item.opened,
      notes: item.notes,
    };
  }
}
