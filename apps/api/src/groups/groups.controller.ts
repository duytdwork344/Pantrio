import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
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
  CreateGroupDto,
  InventoryGroupDto,
  JoinGroupDto,
} from './dto/groups.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get('me')
  @HttpCode(200)
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'Get current user InventoryGroup (JSON null if not a member)',
  })
  @ApiOkResponse({ type: InventoryGroupDto })
  async getMine(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const group = await this.groupsService.getMine(user.id);
    // ExpressAdapter drops a returned `null` into an empty body. Clients
    // then fail to parse "no group". Send JSON null explicitly.
    res.status(200).json(group);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'Create InventoryGroup (caller becomes OWNER; MVP: 1 group/user)',
  })
  @ApiOkResponse({ type: InventoryGroupDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroupDto,
  ): Promise<InventoryGroupDto> {
    return this.groupsService.create(user.id, dto);
  }

  @Post('join')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Join a group by invite code (MVP: 1 group/user)' })
  @ApiOkResponse({ type: InventoryGroupDto })
  join(
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinGroupDto,
  ): Promise<InventoryGroupDto> {
    return this.groupsService.join(user.id, dto);
  }

  @Post('me/leave')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({
    summary:
      'Leave current group (sole OWNER dissolves group + group pantry/lists)',
  })
  leave(@CurrentUser() user: AuthUser) {
    return this.groupsService.leave(user.id);
  }

  @Post('me/rotate-invite')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Rotate invite code (OWNER only)' })
  @ApiOkResponse({ type: InventoryGroupDto })
  rotateInvite(@CurrentUser() user: AuthUser): Promise<InventoryGroupDto> {
    return this.groupsService.rotateInvite(user.id);
  }
}
