import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class ShoppingListSummaryDto {
  id!: string;
  name!: string;
  itemCount!: number;
  pendingCount!: number;
}

@Injectable()
export class ShoppingService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<ShoppingListSummaryDto[]> {
    const lists = await this.prisma.shoppingList.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    });

    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      itemCount: list.items.length,
      pendingCount: list.items.filter((item) => item.status === 'PENDING')
        .length,
    }));
  }
}
