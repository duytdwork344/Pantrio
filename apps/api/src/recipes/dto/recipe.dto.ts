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
    nullable: true,
    description: 'Short recipe video URL (MinIO mp4/webm)',
  })
  videoUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Intent-share count (denormalized)',
  })
  shareCount?: number;

  @ApiPropertyOptional({ nullable: true })
  contentVersion?: number | null;

  @ApiPropertyOptional({ nullable: true })
  moderationStatus?: string | null;

  @ApiPropertyOptional({ nullable: true })
  publishedVersion?: number | null;
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


export class RecipeStepDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;
}

export class RecipeStepInputDto {
  @ApiProperty({ example: 'Boil pasta in salted water until al dente.' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
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

  @ApiProperty({
    description: 'Legacy free-text; prefer steps[]. Derived from steps when writing.',
  })
  instructions!: string;

  @ApiProperty({ type: [RecipeStepDto] })
  steps!: RecipeStepDto[];

  @ApiProperty({ type: [RecipeIngredientDto] })
  ingredients!: RecipeIngredientDto[];

  @ApiPropertyOptional({
    description: 'True when the authenticated user has saved this recipe',
  })
  saved?: boolean;

  @ApiPropertyOptional({
    description:
      'Aggregated nutrition from ingredients (null when no FoodNutrient data)',
  })
  nutrition?: {
    perServing: Array<{
      code: string;
      nameEn: string;
      nameVi: string;
      unit: string;
      group: string;
      sortOrder: number;
      amount: number;
      complete: boolean;
      contributions: Array<{
        foodId: string;
        foodName: string;
        amount: number;
      }>;
    }>;
    total: Array<{
      code: string;
      nameEn: string;
      nameVi: string;
      unit: string;
      group: string;
      sortOrder: number;
      amount: number;
      complete: boolean;
      contributions: Array<{
        foodId: string;
        foodName: string;
        amount: number;
      }>;
    }>;
    servings: number;
    complete: boolean;
    /** Present when viewer has a personal daily nutrition target (7b.10). */
    targetComparison?: {
      source: string;
      energyKcal: number;
      proteinG: number;
      fatG: number;
      carbG: number;
      perServingPercent: Record<string, number | null>;
    };
  } | null;
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

  @ApiPropertyOptional({
    example: '1. Boil pasta...\n2. Mix eggs and cheese...',
    description: 'Legacy; used when steps omitted (split by newline into RecipeStep)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  instructions?: string;

  @ApiPropertyOptional({
    type: [RecipeStepInputDto],
    description: 'Preferred structured steps (with optional per-step imageUrl)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeStepInputDto)
  steps?: RecipeStepInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Short recipe video from POST /media/video',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  videoUrl?: string;

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

  @ApiPropertyOptional({
    example: '1. Chiên trứng...\n2. Xào cơm...',
    description: 'Legacy; used when steps omitted',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  instructions?: string;

  @ApiPropertyOptional({ type: [RecipeStepInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeStepInputDto)
  steps?: RecipeStepInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Short recipe video from POST /media/video',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  videoUrl?: string;

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

export class ReviewFoodDecisionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  foodId!: string;

  @ApiProperty({ enum: ['promote', 'merge'] })
  @IsIn(['promote', 'merge'])
  action!: 'promote' | 'merge';

  @ApiPropertyOptional({
    description: 'Required when action is merge',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  toFoodId?: string;
}

export class FoodCandidateDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  visibility!: string;
}

export class PrivateFoodReviewDto {
  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: [FoodCandidateDto] })
  suggestions!: FoodCandidateDto[];
}

export class ModerationRecipeDetailDto extends RecipeDetailDto {
  @ApiProperty({ type: [PrivateFoodReviewDto] })
  privateFoods!: PrivateFoodReviewDto[];
}

export class ReviewRecipeDto {
  @ApiProperty({ description: 'Revision the moderator reviewed' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    type: [ReviewFoodDecisionDto],
    description:
      'Required for each PRIVATE food that has a similar catalog food. Others are promoted on approve.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewFoodDecisionDto)
  foods?: ReviewFoodDecisionDto[];
}
