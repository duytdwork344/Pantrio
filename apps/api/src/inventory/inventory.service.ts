import { Injectable } from '@nestjs/common';
import { pickTranslation } from '../common/i18n/locale';
import { PrismaService } from '../prisma/prisma.service';

export class InventoryItemDto {
  id!: string;
  foodId!: string;
  foodName!: string;
  quantity!: number;
  unit!: string;
  confidence!: string;
  expiryDate?: string | null;
  storageLocation!: string;
}

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

    return items.map((item) => {
      const translation = pickTranslation(item.food.translations);
      return {
        id: item.id,
        foodId: item.foodId,
        foodName: translation?.name ?? item.food.slug,
        quantity: item.quantity,
        unit: item.unit,
        confidence: item.confidence,
        expiryDate: item.expiryDate?.toISOString() ?? null,
        storageLocation: item.storageLocation,
      };
    });
  }
}
