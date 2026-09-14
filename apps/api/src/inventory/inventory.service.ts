import { Injectable } from '@nestjs/common';
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
      include: { food: true },
      orderBy: [{ expiryDate: 'asc' }, { updatedAt: 'desc' }],
    });

    return items.map((item) => ({
      id: item.id,
      foodId: item.foodId,
      foodName: item.food.name,
      quantity: item.quantity,
      unit: item.unit,
      confidence: item.confidence,
      expiryDate: item.expiryDate?.toISOString() ?? null,
      storageLocation: item.storageLocation,
    }));
  }
}
