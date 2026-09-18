import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ShoppingListItemStatus,
  StorageLocation,
} from '@prisma/client';
import { Unit } from '@pantrio/shared';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { NormalizeUnit } from '../../common/transformers/normalize-unit';

export class ShoppingListSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty()
  pendingCount!: number;
}

export class ShoppingListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  foodId!: string;

  @ApiProperty()
  foodName!: string;

  @ApiPropertyOptional({ nullable: true })
  recipeId?: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ enum: Unit, example: Unit.G })
  unit!: string;

  @ApiProperty({ enum: ShoppingListItemStatus })
  status!: ShoppingListItemStatus;

  @ApiPropertyOptional({ nullable: true })
  note?: string | null;
}

export class ShoppingListDetailDto extends ShoppingListSummaryDto {
  @ApiProperty({ type: [ShoppingListItemDto] })
  items!: ShoppingListItemDto[];
}

export class CreateShoppingListDto {
  @ApiPropertyOptional({ example: 'Weekend shop' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class UpdateShoppingListDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}

export class CreateShoppingListItemDto {
  @ApiProperty()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiPropertyOptional({ type: String, example: 'optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateShoppingListItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ enum: ShoppingListItemStatus })
  @IsOptional()
  @IsEnum(ShoppingListItemStatus)
  status?: ShoppingListItemStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Mua loại hữu cơ',
    description: 'Free-text note, or null to clear',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  note?: string | null;
}

export class GenerateShoppingListDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Planned recipe ids; omit to use all planned recipes',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  plannedRecipeIds?: string[];
}

export class MergeShoppingListsDto {
  @ApiProperty({ example: 'Thức ăn cho cả tuần' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    type: [String],
    description: 'Existing shopping list ids to copy from (owned by user)',
    example: ['clx_weekday', 'clx_weekend'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sourceListIds!: string[];
}

export class PurchaseShoppingItemDto {
  @ApiPropertyOptional({
    type: Number,
    example: 875,
    description:
      'Optional override. Omit to use the shopping item quantity (recommended).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    enum: StorageLocation,
    example: StorageLocation.FRIDGE,
  })
  @IsOptional()
  @IsEnum(StorageLocation)
  storageLocation?: StorageLocation;

  @ApiPropertyOptional({
    enum: Unit,
    example: Unit.G,
    description: 'Optional override. Omit to use the shopping item unit.',
  })
  @IsOptional()
  @NormalizeUnit()
  @IsEnum(Unit)
  unit?: Unit;

  @ApiPropertyOptional({
    example: '2026-09-18T00:00:00.000Z',
    description:
      'Purchase date for the new inventory batch. Defaults to now when omitted.',
  })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Optional expiry for the new inventory batch',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
