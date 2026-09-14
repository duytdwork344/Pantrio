import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeDetailDto, RecipeSummaryDto } from './dto/recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RecipeSummaryDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      slug: recipe.slug,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
    }));
  }

  async findBySlug(slug: string): Promise<RecipeDetailDto | null> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { slug },
      include: {
        ingredients: {
          include: { food: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!recipe) {
      return null;
    }

    return {
      id: recipe.id,
      title: recipe.title,
      slug: recipe.slug,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients.map((item) => ({
        foodId: item.foodId,
        foodName: item.food.name,
        quantity: item.quantity,
        unit: item.unit,
        optional: item.optional,
      })),
    };
  }
}
