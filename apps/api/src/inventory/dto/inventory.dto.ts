import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuantityConfidence,
  StorageLocation,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class InventoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  foodName!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unit!: string;

  @ApiProperty({ enum: QuantityConfidence })
  confidence!: QuantityConfidence;

  @ApiPropertyOptional({ nullable: true })
  expiryDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  purchaseDate?: string | null;

  @ApiProperty({ enum: StorageLocation })
  storageLocation!: StorageLocation;

  @ApiProperty()
  opened!: boolean;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;
}

export class CreateInventoryItemDto {
  @ApiProperty({ description: 'Existing Food.id from GET /foods search' })
  @IsString()
  @MinLength(1)
  foodId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 'g' })
  @IsString()
  @MinLength(1)
  unit!: string;

  @ApiPropertyOptional({
    enum: QuantityConfidence,
    default: QuantityConfidence.APPROXIMATE,
  })
  @IsOptional()
  @IsEnum(QuantityConfidence)
  confidence?: QuantityConfidence;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({
    enum: StorageLocation,
    default: StorageLocation.PANTRY,
  })
  @IsOptional()
  @IsEnum(StorageLocation)
  storageLocation?: StorageLocation;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  opened?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({
    description: 'Set absolute quantity (creates ADJUSTMENT transaction)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ enum: QuantityConfidence })
  @IsOptional()
  @IsEnum(QuantityConfidence)
  confidence?: QuantityConfidence;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @ApiPropertyOptional({ enum: StorageLocation })
  @IsOptional()
  @IsEnum(StorageLocation)
  storageLocation?: StorageLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  opened?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}
