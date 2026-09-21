import {
  Body,
  Controller,
  Get,
  Param,
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
  CookRecipeDto,
  CookingSessionDto,
  RecommendationItemDto,
} from './dto/cooking.dto';
import { CookingService } from './cooking.service';

@ApiTags('cooking')
@ApiBearerAuth()
@Controller()
export class CookingController {
  constructor(private readonly cookingService: CookingService) {}

  @Post('cook')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Cook a recipe: CookingSession + FEFO ESTIMATED_CONSUME (personal or group pantry via groupId)',
  })
  @ApiOkResponse({ type: CookingSessionDto })
  cook(
    @CurrentUser() user: AuthUser,
    @Body() dto: CookRecipeDto,
  ): Promise<CookingSessionDto> {
    return this.cookingService.cook(user.id, dto);
  }

  @Get('cooking-sessions')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'List recent cooking sessions for current user' })
  @ApiOkResponse({ type: [CookingSessionDto] })
  list(@CurrentUser() user: AuthUser): Promise<CookingSessionDto[]> {
    return this.cookingService.listSessions(user.id);
  }

  @Get('cooking-sessions/:id')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Get a cooking session' })
  @ApiOkResponse({ type: CookingSessionDto })
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CookingSessionDto> {
    return this.cookingService.getSession(user.id, id);
  }

  @Post('cooking-sessions/:id/undo')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Undo a cooking session: restore consumed batches and delete the session',
  })
  undo(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cookingService.undo(user.id, id);
  }

  @Get('recommendations/recipes')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Recommend recipes from pantry (personal by default; pass groupId for shared pantry)',
  })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiOkResponse({ type: [RecommendationItemDto] })
  recommend(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
  ): Promise<RecommendationItemDto[]> {
    return this.cookingService.recommend(
      user.id,
      groupId?.trim() || undefined,
    );
  }
}
