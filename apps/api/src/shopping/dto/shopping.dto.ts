import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ShoppingListItemStatus,
  StorageLocation,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

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

  @ApiProperty()
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

  @ApiProperty({ example: 'g' })
  @IsString()
  @MinLength(1)
  unit!: string;

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
    type: String,
    example: 'g',
    description: 'Optional override. Omit to use the shopping item unit.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;
}
