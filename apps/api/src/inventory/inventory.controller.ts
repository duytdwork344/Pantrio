import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
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
    summary:
      'List inventory batches (personal by default; pass groupId for shared pantry)',
  })
  @ApiQuery({
    name: 'groupId',
    required: false,
    description: 'InventoryGroup id — list shared pantry for that group',
  })
  @ApiOkResponse({ type: [InventoryItemDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
  ): Promise<InventoryItemDto[]> {
    return this.inventoryService.list(user, groupId?.trim() || undefined);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Add inventory batch (foodId must be PUBLIC or your own PRIVATE; optional groupId)',
  })
  @ApiOkResponse({ type: InventoryItemDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Update inventory batch (quantity/unit changes write ADJUSTMENT txn)',
  })
  @ApiOkResponse({ type: InventoryItemDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Remove inventory batch (writes DISPOSE then deletes; txn history for this batch is removed)',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.remove(user, id);
  }
}
