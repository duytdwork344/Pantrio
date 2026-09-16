import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeasurementType } from '@prisma/client';
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

  @ApiProperty({ example: 'g' })
  baseUnit!: string;

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

  @ApiProperty({ example: 'g' })
  @IsString()
  @MinLength(1)
  baseUnit!: string;

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

  @ApiPropertyOptional({ example: 'g' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  baseUnit?: string;

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
