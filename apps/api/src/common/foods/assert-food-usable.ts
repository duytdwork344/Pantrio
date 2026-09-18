import { BadRequestException } from '@nestjs/common';
import { FoodVisibility } from '@prisma/client';
import type { AuthUser } from '../decorators/current-user.decorator';
import type { PrismaService } from '../../prisma/prisma.service';

/** PUBLIC for anyone; PRIVATE only for the owner (no manager bypass). */
export function isFoodUsableBy(
  food: { visibility: FoodVisibility; createdByUserId: string | null },
  userId: string,
): boolean {
  if (food.visibility === FoodVisibility.PUBLIC) {
    return true;
  }
  return (
    food.visibility === FoodVisibility.PRIVATE &&
    food.createdByUserId === userId
  );
}

export async function assertFoodsUsable(
  prisma: PrismaService,
  foodIds: string[],
  user: AuthUser,
): Promise<void> {
  const uniqueIds = [...new Set(foodIds)];
  if (uniqueIds.length === 0) {
    return;
  }

  const foods = await prisma.food.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      visibility: true,
      createdByUserId: true,
    },
  });

  const byId = new Map(foods.map((food) => [food.id, food]));
  const missing = uniqueIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new BadRequestException(
      `Unknown foodId(s): ${missing.join(', ')}. Search GET /foods first.`,
    );
  }

  const forbidden = uniqueIds.filter((id) => {
    const food = byId.get(id)!;
    return !isFoodUsableBy(food, user.id);
  });
  if (forbidden.length > 0) {
    throw new BadRequestException(
      `Food id(s) not usable (PRIVATE owned by another user): ${forbidden.join(', ')}`,
    );
  }
}
