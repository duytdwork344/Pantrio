import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { RecipeDetailDto, ReviewRecipeDto } from './dto/recipe.dto';
import { RecipesService } from './recipes.service';

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation/recipes')
export class RecipeModerationController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary: 'Catalog recipes whose latest revision is pending review',
  })
  listPending() {
    return this.recipesService.listPendingRevisions();
  }

  @Get(':id')
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary:
      'Read one revision. Omit version to load the latest snapshot the author submitted.',
  })
  @ApiQuery({ name: 'version', required: false })
  @ApiOkResponse({ type: RecipeDetailDto })
  getOne(@Param('id') id: string, @Query('version') version?: string) {
    const parsed = version ? Number(version) : undefined;
    return this.recipesService.getRevisionForReview(
      id,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary:
      'Publish this version. 409 if the author saved a newer revision after the moderator opened it.',
  })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiConflictResponse({ description: 'A newer revision exists' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewRecipeDto,
  ) {
    return this.recipesService.approveRevision(id, user, dto);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary:
      'Reject this version. The previously published snapshot stays on Discover.',
  })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiConflictResponse({ description: 'A newer revision exists' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewRecipeDto,
  ) {
    return this.recipesService.rejectRevision(id, user, dto);
  }
}
