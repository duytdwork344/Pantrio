import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecipeDifficulty } from '@prisma/client';

export class RecipeSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  servings!: number;

  @ApiPropertyOptional()
  prepTimeMin?: number | null;

  @ApiPropertyOptional()
  cookTimeMin?: number | null;

  @ApiProperty({ enum: RecipeDifficulty })
  difficulty!: RecipeDifficulty;

  @ApiPropertyOptional()
  imageUrl?: string | null;
}

export class RecipeIngredientDto {
  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  foodName!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unit!: string;

  @ApiProperty()
  optional!: boolean;
}

export class RecipeDetailDto extends RecipeSummaryDto {
  @ApiProperty()
  instructions!: string;

  @ApiProperty({ type: [RecipeIngredientDto] })
  ingredients!: RecipeIngredientDto[];
}
