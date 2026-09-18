import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  GenerateShoppingListDto,
  MergeShoppingListsDto,
  PurchaseShoppingItemDto,
  ShoppingListDetailDto,
  ShoppingListItemDto,
  ShoppingListSummaryDto,
  UpdateShoppingListDto,
  UpdateShoppingListItemDto,
} from './dto/shopping.dto';
import { ShoppingService } from './shopping.service';

@ApiTags('shopping')
@ApiBearerAuth()
@Controller('shopping-lists')
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get()
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'List shopping lists for current user' })
  @ApiOkResponse({ type: [ShoppingListSummaryDto] })
  list(@CurrentUser() user: AuthUser): Promise<ShoppingListSummaryDto[]> {
    return this.shoppingService.listForUser(user.id);
  }

  @Post()
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'Create a shopping list' })
  @ApiOkResponse({ type: ShoppingListDetailDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShoppingListDto,
  ): Promise<ShoppingListDetailDto> {
    return this.shoppingService.create(user.id, dto);
  }

  @Post('merge-from-lists')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({
    summary:
      'Create a new list by merging existing lists (copy; aggregate foodId+unit → PENDING; skip SKIPPED; sources unchanged)',
  })
  @ApiOkResponse({ type: ShoppingListDetailDto })
  mergeFromLists(
    @CurrentUser() user: AuthUser,
    @Body() dto: MergeShoppingListsDto,
  ): Promise<ShoppingListDetailDto> {
    return this.shoppingService.mergeFromLists(user.id, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'Get shopping list detail with items' })
  @ApiOkResponse({ type: ShoppingListDetailDto })
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ShoppingListDetailDto> {
    return this.shoppingService.getDetail(user.id, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'Rename shopping list' })
  @ApiOkResponse({ type: ShoppingListDetailDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateShoppingListDto,
  ): Promise<ShoppingListDetailDto> {
    return this.shoppingService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'Delete shopping list and its items' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shoppingService.remove(user.id, id);
  }

  @Post(':id/reset')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({
    summary:
      'Reset PURCHASED/SKIPPED items to PENDING for reuse (does not change Inventory)',
  })
  @ApiOkResponse({ type: ShoppingListDetailDto })
  reset(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ShoppingListDetailDto> {
    return this.shoppingService.reset(user.id, id);
  }

  @Post(':id/items')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({
    summary:
      'Add an item manually (foodId must be PUBLIC or your own PRIVATE)',
  })
  @ApiOkResponse({ type: ShoppingListItemDto })
  addItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    return this.shoppingService.addItem(user, id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'Update shopping item quantity / status / note' })
  @ApiOkResponse({ type: ShoppingListItemDto })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    return this.shoppingService.updateItem(user.id, id, itemId, dto);
  }

  @Post(':id/generate-from-planned')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({
    summary:
      'Generate/merge PENDING items from PlannedRecipe − Inventory (by foodId+unit)',
  })
  @ApiOkResponse({ type: ShoppingListDetailDto })
  generate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateShoppingListDto = {},
  ): Promise<ShoppingListDetailDto> {
    return this.shoppingService.generateFromPlanned(user.id, id, dto);
  }

  @Post(':id/items/:itemId/purchase')
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({
    summary:
      'Mark item purchased and create InventoryItem (+ PURCHASE transaction)',
  })
  purchase(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PurchaseShoppingItemDto = {},
  ) {
    return this.shoppingService.purchaseItem(user.id, id, itemId, dto);
  }
}
