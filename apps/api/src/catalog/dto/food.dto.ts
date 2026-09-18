import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodVisibility, MeasurementType } from '@prisma/client';
import { Unit } from '@pantrio/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NormalizeUnit } from '../../common/transformers/normalize-unit';

export class FoodTranslationDto {
  @ApiProperty({ example: 'vi' })
  locale!: string;

  @ApiProperty({ example: 'Gà' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'protein' })
  category?: string | null;
}

export class FoodDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ description: 'Resolved name for the requested locale' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  category?: string | null;

  @ApiProperty({ example: 'vi' })
  locale!: string;

  @ApiProperty({ enum: MeasurementType })
  measurementType!: MeasurementType;

  @ApiProperty({ enum: Unit, example: Unit.G })
  baseUnit!: string;

  @ApiProperty({ enum: FoodVisibility })
  visibility!: FoodVisibility;

  @ApiPropertyOptional({ nullable: true })
  createdByUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;

  @ApiProperty({ type: [FoodTranslationDto] })
  translations!: FoodTranslationDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UpsertFoodTranslationDto {
  @ApiProperty({ example: 'vi' })
  @IsString()
  @MinLength(2)
  locale!: string;

  @ApiProperty({ example: 'Gà' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'protein' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class CreateFoodDto {
  @ApiPropertyOptional({
    example: 'chicken',
    description: 'Stable slug; auto-generated from primary translation name if omitted',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @ApiProperty({ enum: MeasurementType, example: MeasurementType.WEIGHT })
  @IsEnum(MeasurementType)
  measurementType!: MeasurementType;

  @ApiProperty({ enum: Unit, example: Unit.G })
  @NormalizeUnit()
  @IsEnum(Unit)
  baseUnit!: Unit;

  @ApiPropertyOptional({
    enum: FoodVisibility,
    description:
      'Only catalog managers can set PUBLIC. Others always create PRIVATE.',
  })
  @IsOptional()
  @IsEnum(FoodVisibility)
  visibility?: FoodVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ type: [UpsertFoodTranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertFoodTranslationDto)
  translations!: UpsertFoodTranslationDto[];
}

export class UpdateFoodDto {
  @ApiPropertyOptional({ enum: MeasurementType })
  @IsOptional()
  @IsEnum(MeasurementType)
  measurementType?: MeasurementType;

  @ApiPropertyOptional({ enum: Unit, example: Unit.G })
  @IsOptional()
  @NormalizeUnit()
  @IsEnum(Unit)
  baseUnit?: Unit;

  @ApiPropertyOptional({
    enum: FoodVisibility,
    description: 'catalog:manage / moderation can promote PRIVATE → PUBLIC',
  })
  @IsOptional()
  @IsEnum(FoodVisibility)
  visibility?: FoodVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    type: [UpsertFoodTranslationDto],
    description: 'Upsert translations by locale',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertFoodTranslationDto)
  translations?: UpsertFoodTranslationDto[];
}

export class FoodReferenceCountsDto {
  @ApiProperty()
  recipeIngredients!: number;

  @ApiProperty()
  inventoryItems!: number;

  @ApiProperty()
  shoppingListItems!: number;

  @ApiProperty()
  total!: number;
}

export class ModeratedFoodDto extends FoodDto {
  @ApiProperty({ type: FoodReferenceCountsDto })
  references!: FoodReferenceCountsDto;
}

export class MergeFoodDto {
  @ApiProperty({ description: 'Food id to merge away (usually PRIVATE duplicate)' })
  @IsString()
  @MinLength(1)
  fromFoodId!: string;

  @ApiProperty({
    description:
      'Canonical food id to keep; if PRIVATE, merge auto-promotes it to PUBLIC',
  })
  @IsString()
  @MinLength(1)
  toFoodId!: string;
}

export class MergeFoodResultDto {
  @ApiProperty()
  fromFoodId!: string;

  @ApiProperty()
  toFoodId!: string;

  @ApiProperty()
  remappedRecipeIngredients!: number;

  @ApiProperty()
  remappedInventoryItems!: number;

  @ApiProperty()
  remappedShoppingListItems!: number;

  @ApiProperty()
  deletedFromFood!: boolean;

  @ApiProperty({
    description: 'True when toFood was PRIVATE and was promoted to PUBLIC',
  })
  promotedToPublic!: boolean;
}
