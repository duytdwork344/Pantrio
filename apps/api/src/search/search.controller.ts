import { Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@pantrio/shared';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  ReindexRecipesResultDto,
  RecipeSearchHitDto,
  SearchRecipesQueryDto,
} from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get('recipes')
  @ApiOperation({
    summary:
      'Search public catalog recipes (OpenSearch; SQL fallback if the cluster is down)',
  })
  @ApiOkResponse({ type: [RecipeSearchHitDto] })
  async searchRecipes(
    @Query() query: SearchRecipesQueryDto,
  ): Promise<RecipeSearchHitDto[]> {
    const { hits } = await this.searchService.searchRecipes({
      q: query.q,
      difficulty: query.difficulty,
      maxCookTimeMin: query.maxCookTimeMin,
      limit: query.limit,
    });
    return hits;
  }

  @Post('recipes/reindex')
  @ApiBearerAuth()
  @RequirePermissions(Permission.MODERATION)
  @ApiOperation({
    summary: 'Rebuild pantrio-recipes from Postgres public published recipes',
  })
  @ApiOkResponse({ type: ReindexRecipesResultDto })
  reindex(): Promise<ReindexRecipesResultDto> {
    return this.searchService.reindexPublicRecipes();
  }
}
