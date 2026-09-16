import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@pantrio/shared';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  CreateInventoryItemDto,
  InventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

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
  @ApiOkResponse({ type: [InventoryItemDto] })
  list(@CurrentUser() user: AuthUser): Promise<InventoryItemDto[]> {
    return this.inventoryService.listForUser(user.id);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Add an inventory batch for an existing foodId (search GET /foods first)',
  })
  @ApiOkResponse({ type: InventoryItemDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.create(user.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'Update inventory batch (quantity adjust writes ADJUSTMENT txn)',
  })
  @ApiOkResponse({ type: InventoryItemDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.update(user.id, id, dto);
  }
}
