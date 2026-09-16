import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionType,
  QuantityConfidence,
  StorageLocation,
} from '@prisma/client';
import { pickTranslation } from '../common/i18n/locale';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInventoryItemDto,
  InventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<InventoryItemDto[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { userId },
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
    userId: string,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const food = await this.prisma.food.findUnique({
      where: { id: dto.foodId },
      select: { id: true },
    });
    if (!food) {
      throw new BadRequestException(
        `Unknown foodId '${dto.foodId}'. Search GET /foods first.`,
      );
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          userId,
          foodId: dto.foodId,
          quantity: dto.quantity,
          unit: dto.unit.trim(),
          confidence: dto.confidence ?? QuantityConfidence.APPROXIMATE,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
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
          userId,
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
    userId: string,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Inventory item '${id}' not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Not your inventory item');
    }

    const item = await this.prisma.$transaction(async (tx) => {
      if (dto.quantity !== undefined && dto.quantity !== existing.quantity) {
        const delta = dto.quantity - existing.quantity;
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: id,
            userId,
            type: InventoryTransactionType.ADJUSTMENT,
            quantity: delta,
            unit: existing.unit,
            note: 'Manual quantity update',
            estimated: false,
          },
        });
      }

      return tx.inventoryItem.update({
        where: { id },
        data: {
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.confidence !== undefined
            ? { confidence: dto.confidence }
            : {}),
          ...(dto.expiryDate !== undefined
            ? {
                expiryDate:
                  dto.expiryDate === null ? null : new Date(dto.expiryDate),
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

  private toDto(item: {
    id: string;
    foodId: string;
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
