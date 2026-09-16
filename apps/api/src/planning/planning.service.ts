import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePlannedRecipeDto,
  PlannedRecipeDto,
  UpdatePlannedRecipeDto,
} from './dto/planned-recipe.dto';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<PlannedRecipeDto[]> {
    const rows = await this.prisma.plannedRecipe.findMany({
      where: { userId },
      include: { recipe: true },
      orderBy: [{ plannedFor: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toDto(row));
  }

  async create(
    userId: string,
    dto: CreatePlannedRecipeDto,
  ): Promise<PlannedRecipeDto> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipeId },
      select: { id: true },
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe '${dto.recipeId}' not found`);
    }

    const row = await this.prisma.plannedRecipe.create({
      data: {
        userId,
        recipeId: dto.recipeId,
        servings: dto.servings,
        plannedFor: dto.plannedFor ? new Date(dto.plannedFor) : null,
      },
      include: { recipe: true },
    });

    return this.toDto(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdatePlannedRecipeDto,
  ): Promise<PlannedRecipeDto> {
    await this.assertOwned(userId, id);

    const row = await this.prisma.plannedRecipe.update({
      where: { id },
      data: {
        ...(dto.servings !== undefined ? { servings: dto.servings } : {}),
        ...(dto.plannedFor !== undefined
          ? {
              plannedFor:
                dto.plannedFor === null ? null : new Date(dto.plannedFor),
            }
          : {}),
      },
      include: { recipe: true },
    });

    return this.toDto(row);
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.plannedRecipe.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async assertOwned(userId: string, id: string) {
    const row = await this.prisma.plannedRecipe.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException(`Planned recipe '${id}' not found`);
    }
  }

  private toDto(row: {
    id: string;
    recipeId: string;
    servings: number;
    plannedFor: Date | null;
    createdAt: Date;
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
  }): PlannedRecipeDto {
    return {
      id: row.id,
      recipeId: row.recipeId,
      servings: row.servings,
      plannedFor: row.plannedFor?.toISOString() ?? null,
      createdAt: row.createdAt,
      recipe: {
        id: row.recipe.id,
        title: row.recipe.title,
        slug: row.recipe.slug,
        description: row.recipe.description,
        servings: row.recipe.servings,
        prepTimeMin: row.recipe.prepTimeMin,
        cookTimeMin: row.recipe.cookTimeMin,
        difficulty: row.recipe.difficulty,
        imageUrl: row.recipe.imageUrl,
      },
    };
  }
}
