import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RecipeSummaryDto } from '../../recipes/dto/recipe.dto';

export class PlannedRecipeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  recipeId!: string;

  @ApiProperty()
  servings!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-09-20T12:00:00.000Z',
  })
  plannedFor?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: RecipeSummaryDto })
  recipe!: RecipeSummaryDto;
}

export class CreatePlannedRecipeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  servings!: number;

  @ApiPropertyOptional({ example: '2026-09-20T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  plannedFor?: string;
}

export class UpdatePlannedRecipeDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  servings?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-09-20T12:00:00.000Z',
    description:
      'One planned datetime (ISO-8601). Not a date range. Send null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  plannedFor?: string | null;
}
