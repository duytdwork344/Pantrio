import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@pantrio/shared';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ShoppingService } from './shopping.service';

class ShoppingListSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty()
  pendingCount!: number;
}

@ApiTags('shopping')
@ApiBearerAuth()
@Controller('shopping-lists')
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get()
  @RequirePermissions(Permission.SHOPPING_MANAGE)
  @ApiOperation({ summary: 'List shopping lists for current user' })
  @ApiOkResponse({ type: [ShoppingListSummaryResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
  ): Promise<ShoppingListSummaryResponseDto[]> {
    return this.shoppingService.listForUser(user.id);
  }
}
