import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@pantrio/shared';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';

class InventoryItemResponseDto {
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

  @ApiProperty()
  confidence!: string;

  @ApiPropertyOptional()
  expiryDate?: string | null;

  @ApiProperty()
  storageLocation!: string;
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'List current user inventory batches (FEFO ordered)',
  })
  @ApiOkResponse({ type: [InventoryItemResponseDto] })
  list(@CurrentUser() user: AuthUser): Promise<InventoryItemResponseDto[]> {
    return this.inventoryService.listForUser(user.id);
  }
}
