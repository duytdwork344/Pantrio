import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityLevel,
  NutritionPresetCode,
  NutritionTargetSource,
  Sex,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class NutritionTargetDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  sex!: Sex | null;

  @ApiPropertyOptional({ nullable: true })
  ageYears!: number | null;

  @ApiPropertyOptional({ nullable: true })
  weightKg!: number | null;

  @ApiPropertyOptional({ nullable: true })
  heightCm!: number | null;

  @ApiProperty({ enum: ActivityLevel })
  activity!: ActivityLevel;

  @ApiProperty({ enum: NutritionTargetSource })
  source!: NutritionTargetSource;

  @ApiPropertyOptional({ enum: NutritionPresetCode, nullable: true })
  presetCode!: NutritionPresetCode | null;

  @ApiProperty()
  energyKcal!: number;

  @ApiProperty()
  proteinG!: number;

  @ApiProperty()
  fatG!: number;

  @ApiProperty()
  carbG!: number;

  @ApiPropertyOptional({ nullable: true })
  bmrKcal!: number | null;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({
    description: 'Short disclaimer for clients to show near targets',
  })
  disclaimer!: string;
}

export class ComputeNutritionTargetDto {
  @ApiProperty({ enum: Sex })
  @IsEnum(Sex)
  sex!: Sex;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  ageYears!: number;

  @ApiProperty({ example: 65 })
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg!: number;

  @ApiProperty({ example: 165 })
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(250)
  heightCm!: number;

  @ApiPropertyOptional({ enum: ActivityLevel, default: ActivityLevel.MODERATE })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activity?: ActivityLevel;
}

export class ApplyPresetNutritionTargetDto {
  @ApiProperty({ enum: NutritionPresetCode })
  @IsEnum(NutritionPresetCode)
  presetCode!: NutritionPresetCode;
}

export class ManualNutritionTargetDto {
  @ApiProperty({ example: 2000 })
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(10000)
  energyKcal!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  proteinG!: number;

  @ApiProperty({ example: 67 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  fatG!: number;

  @ApiProperty({ example: 250 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  carbG!: number;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  ageYears?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ enum: ActivityLevel })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activity?: ActivityLevel;
}

export class NutritionTargetComparisonDto {
  @ApiProperty({ enum: NutritionTargetSource })
  source!: NutritionTargetSource;

  @ApiProperty()
  energyKcal!: number;

  @ApiProperty()
  proteinG!: number;

  @ApiProperty()
  fatG!: number;

  @ApiProperty()
  carbG!: number;

  @ApiProperty({
    description:
      'Per-serving amount as % of daily target (energy_kcal, protein, fat, carb)',
    example: { energy_kcal: 12.5, protein: 18.0, fat: 10.2, carb: 9.1 },
  })
  perServingPercent!: Record<string, number | null>;
}
