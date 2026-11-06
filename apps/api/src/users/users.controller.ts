import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import { ErrorCode } from '@pantrio/shared';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { AppException } from '../common/errors/app-exception';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  async me(@CurrentUser() authUser: AuthUser): Promise<UserProfileDto> {
    const profile = await this.usersService.getProfile(authUser.id);
    if (!profile) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        'User not found',
      );
    }
    return profile;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user (locale, display name)' })
  @ApiOkResponse({ type: UserProfileDto })
  async updateMe(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<UserProfileDto> {
    const profile = await this.usersService.updateMe(authUser.id, dto);
    if (!profile) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        'User not found',
      );
    }
    return profile;
  }
}
