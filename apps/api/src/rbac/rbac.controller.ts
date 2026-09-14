import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@pantrio/shared';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AssignRoleDto, RoleDto } from './dto/rbac.dto';
import { RbacService } from './rbac.service';

@ApiTags('rbac')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions(Permission.SYSTEM_MANAGE)
  @ApiOperation({ summary: 'List roles and their permissions' })
  @ApiOkResponse({ type: [RoleDto] })
  async listRoles(): Promise<RoleDto[]> {
    const roles = await this.rbacService.listRoles();
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((item) => item.permission.code),
    }));
  }

  @Post('assign')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Assign a role to a user (additive)' })
  assignRole(@Body() dto: AssignRoleDto) {
    return this.rbacService.assignRole(dto.userId, dto.roleName);
  }
}
