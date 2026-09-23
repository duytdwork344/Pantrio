import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RecipeDifficulty, RecipeVisibility } from '@prisma/client';
import { Unit } from '@pantrio/shared';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NormalizeUnit } from '../../common/transformers/normalize-unit';

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

  @ApiPropertyOptional({
    description: 'Intent-share count (denormalized)',
  })
  shareCount?: number;
}

export class RecipeIngredientDto {
  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  foodName!: string;

  @ApiPropertyOptional({ nullable: true })
  foodImageUrl?: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ enum: Unit, example: Unit.G })
  unit!: string;

  @ApiPropertyOptional({ nullable: true })
  note?: string | null;

  @ApiProperty()
  optional!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({
    description:
      'True when the authenticated user has this foodId in inventory (any batch)',
  })
  inInventory?: boolean;
}

export class RecipeDetailDto extends RecipeSummaryDto {
  @ApiProperty()
  authorId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set when visibility = GROUP (group cookbook)',
  })
  groupId?: string | null;

  @ApiProperty({ enum: RecipeVisibility })
  visibility!: RecipeVisibility;

  @ApiProperty()
  instructions!: string;

  @ApiProperty({ type: [RecipeIngredientDto] })
  ingredients!: RecipeIngredientDto[];

  @ApiPropertyOptional({
    description: 'True when the authenticated user has saved this recipe',
  })
  saved?: boolean;
}

export class SavedRecipeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  recipeId!: string;

  @ApiProperty()
  savedAt!: Date;

  @ApiProperty({ type: RecipeSummaryDto })
  recipe!: RecipeSummaryDto;
}

export class RecipeIngredientInputDto {
  @ApiProperty({ description: 'Existing Food.id from catalog search' })
  @IsString()
  @MinLength(1)
  foodId!: string;

  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ enum: Unit, example: Unit.G })
  @NormalizeUnit()
  @IsEnum(Unit)
  unit!: Unit;

  @ApiPropertyOptional({ example: 'pancetta if available' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  optional?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateRecipeDto {
  @ApiProperty({ example: 'Classic Carbonara' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({
    example: 'classic-carbonara',
    description: 'Stable slug; auto-generated from title if omitted',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  servings?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMin?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cookTimeMin?: number;

  @ApiPropertyOptional({
    enum: RecipeDifficulty,
    default: RecipeDifficulty.EASY,
  })
  @IsOptional()
  @IsEnum(RecipeDifficulty)
  difficulty?: RecipeDifficulty;

  @ApiProperty({ example: '1. Boil pasta...\n2. Mix eggs and cheese...' })
  @IsString()
  @MinLength(1)
  instructions!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    enum: RecipeVisibility,
    default: RecipeVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(RecipeVisibility)
  visibility?: RecipeVisibility;

  @ApiProperty({ type: [RecipeIngredientInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients!: RecipeIngredientInputDto[];
}

/** Catalog create/update — do not set groupId / GROUP here (use /groups/me/recipes). */
export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}

/** Body for POST /groups/me/recipes — visibility/groupId are forced by the server. */
export class CreateGroupRecipeDto {
  @ApiProperty({ example: 'Cơm chiên nhà làm' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  servings?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMin?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cookTimeMin?: number;

  @ApiPropertyOptional({
    enum: RecipeDifficulty,
    default: RecipeDifficulty.EASY,
  })
  @IsOptional()
  @IsEnum(RecipeDifficulty)
  difficulty?: RecipeDifficulty;

  @ApiProperty({ example: '1. Chiên trứng...\n2. Xào cơm...' })
  @IsString()
  @MinLength(1)
  instructions!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ type: [RecipeIngredientInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients!: RecipeIngredientInputDto[];
}

export class UpdateGroupRecipeDto extends PartialType(CreateGroupRecipeDto) {}

export const SHARE_CHANNELS = [
  'copy',
  'native',
  'facebook',
  'x',
  'unknown',
] as const;

export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export class ShareRecipeDto {
  @ApiPropertyOptional({
    description:
      'Intent channel only (not delivery proof). native = OS share sheet.',
    enum: SHARE_CHANNELS,
    example: 'copy',
  })
  @IsOptional()
  @IsString()
  @IsIn([...SHARE_CHANNELS])
  channel?: ShareChannel;
}

export class ShareRecipeResultDto {
  @ApiProperty()
  recipeId!: string;

  @ApiProperty()
  shareCount!: number;

  @ApiProperty({ enum: SHARE_CHANNELS })
  channel!: string;

  @ApiPropertyOptional({
    description: 'True when rate-limited; shareCount unchanged',
  })
  rateLimited?: boolean;
}
