import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuantityConfidence,
  StorageLocation,
} from '@prisma/client';
import { Unit } from '@pantrio/shared';
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
import { NormalizeUnit } from '../../common/transformers/normalize-unit';

export class InventoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  foodName!: string;

  @ApiPropertyOptional({ nullable: true })
  foodImageUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null = personal batch; set = InventoryGroup pantry',
  })
  groupId?: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ enum: Unit, example: Unit.G })
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

  @ApiPropertyOptional({
    description:
      'When set, batch belongs to InventoryGroup (caller must be a member)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  groupId?: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ enum: Unit, example: Unit.G })
  @NormalizeUnit()
  @IsEnum(Unit)
  unit!: Unit;

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

  @ApiPropertyOptional({
    enum: Unit,
    example: Unit.G,
    description: 'Correct batch unit (e.g. after purchase override mistake)',
  })
  @IsOptional()
  @NormalizeUnit()
  @IsEnum(Unit)
  unit?: Unit;

  @ApiPropertyOptional({ enum: QuantityConfidence })
  @IsOptional()
  @IsEnum(QuantityConfidence)
  confidence?: QuantityConfidence;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-10-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-09-18T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @ApiPropertyOptional({ enum: StorageLocation })
  @IsOptional()
  @IsEnum(StorageLocation)
  storageLocation?: StorageLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  opened?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Opened yesterday',
  })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
