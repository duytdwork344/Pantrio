import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecipeDifficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SearchRecipesQueryDto {
  @ApiPropertyOptional({
    description: 'Full-text query over title, description, ingredients, instructions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: RecipeDifficulty })
  @IsOptional()
  @IsEnum(RecipeDifficulty)
  difficulty?: RecipeDifficulty;

  @ApiPropertyOptional({ description: 'Maximum cook time in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCookTimeMin?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class RecipeSearchHitDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  servings!: number;

  @ApiPropertyOptional({ nullable: true })
  prepTimeMin?: number | null;

  @ApiPropertyOptional({ nullable: true })
  cookTimeMin?: number | null;

  @ApiProperty({ enum: RecipeDifficulty })
  difficulty!: RecipeDifficulty;

  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;

  @ApiProperty()
  shareCount!: number;

  @ApiPropertyOptional({ description: 'OpenSearch score when available' })
  score?: number;
}

export class ReindexRecipesResultDto {
  @ApiProperty()
  indexed!: number;

  @ApiProperty()
  removed!: number;

  @ApiProperty({ description: 'opensearch | sql-fallback' })
  backend!: string;
}
