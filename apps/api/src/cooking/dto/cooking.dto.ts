import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unit } from '@pantrio/shared';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { RecipeSummaryDto } from '../../recipes/dto/recipe.dto';

export class CookRecipeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  servings!: number;

  @ApiPropertyOptional({
    description:
      'When set, FEFO consume from InventoryGroup pantry (caller must be a member)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConsumptionLineDto {
  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  foodName!: string;

  @ApiProperty()
  neededQuantity!: number;

  @ApiProperty({ enum: Unit })
  neededUnit!: string;

  @ApiProperty()
  consumedQuantity!: number;

  @ApiProperty({ enum: Unit })
  consumedUnit!: string;

  @ApiProperty()
  shortfallQuantity!: number;

  @ApiProperty({ type: [String] })
  batchIds!: string[];
}

export class CookingSessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  recipeId!: string;

  @ApiProperty()
  servings!: number;

  @ApiProperty()
  cookedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty({ type: RecipeSummaryDto })
  recipe!: RecipeSummaryDto;

  @ApiProperty({ type: [ConsumptionLineDto] })
  consumptions!: ConsumptionLineDto[];
}

export class RecommendationItemDto {
  @ApiProperty({ type: RecipeSummaryDto })
  recipe!: RecipeSummaryDto;

  @ApiProperty()
  requiredCount!: number;

  @ApiProperty()
  matchedCount!: number;

  @ApiProperty()
  missingCount!: number;

  @ApiProperty({
    description: 'True when all non-optional ingredients are covered in inventory',
  })
  canCook!: boolean;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        foodId: { type: 'string' },
        foodName: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string' },
      },
    },
  })
  missing!: Array<{
    foodId: string;
    foodName: string;
    quantity: number;
    unit: string;
  }>;
}
