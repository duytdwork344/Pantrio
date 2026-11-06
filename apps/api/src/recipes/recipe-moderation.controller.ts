import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
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
import {
  ModerationRecipeDetailDto,
  RecipeTranslationBodyDto,
  ReviewRecipeDto,
} from './dto/recipe.dto';
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

  @Get('missing-translations')
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary:
      'Published catalog recipes without a complete translation in `locale` (requirements 2b.3 #3)',
  })
  @ApiQuery({ name: 'locale', required: true, example: 'en' })
  listMissingTranslations(@Query('locale') locale: string) {
    return this.recipesService.listMissingTranslations(locale);
  }

  @Put(':id/translations/:locale')
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary:
      'Add or fix a translation. Saved into the pending revision when there is one (publish with approve); otherwise published right away as a new revision.',
  })
  @ApiOkResponse({ type: ModerationRecipeDetailDto })
  @ApiConflictResponse({ description: 'The revision changed meanwhile' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RecipeTranslationBodyDto,
  ) {
    return this.recipesService.upsertTranslationAsModerator(
      id,
      locale,
      dto,
      user,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary:
      'Read one revision. Omit version to load the latest snapshot the author submitted.',
  })
  @ApiQuery({ name: 'version', required: false })
  @ApiOkResponse({ type: ModerationRecipeDetailDto })
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
      'Publish this version after private foods are merged or promoted. 409 if the author saved a newer revision.',
  })
  @ApiOkResponse({ type: ModerationRecipeDetailDto })
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
  @ApiOkResponse({ type: ModerationRecipeDetailDto })
  @ApiConflictResponse({ description: 'A newer revision exists' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewRecipeDto,
  ) {
    return this.recipesService.rejectRevision(id, user, dto);
  }
}
