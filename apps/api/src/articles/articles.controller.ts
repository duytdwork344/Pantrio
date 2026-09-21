import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  ArticleDetailDto,
  ArticleSummaryDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';
import { ArticlesService } from './articles.service';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published articles' })
  @ApiOkResponse({ type: [ArticleSummaryDto] })
  list(): Promise<ArticleSummaryDto[]> {
    return this.articlesService.listPublished();
  }

  @Public()
  @Get(':slug')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get article by slug (published public; draft only visible to author)',
  })
  @ApiOkResponse({ type: ArticleDetailDto })
  get(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<ArticleDetailDto> {
    return this.articlesService.findBySlug(slug, user);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermissions(Permission.ARTICLE_CREATE)
  @ApiOperation({
    summary:
      'Create article (CREATOR); draft unless publish=true; optional recipeIds',
  })
  @ApiOkResponse({ type: ArticleDetailDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateArticleDto,
  ): Promise<ArticleDetailDto> {
    return this.articlesService.create(user, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions(Permission.ARTICLE_CREATE)
  @ApiOperation({
    summary:
      'Update own article (publish + replace recipeIds when provided)',
  })
  @ApiOkResponse({ type: ArticleDetailDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleDetailDto> {
    return this.articlesService.update(id, user, dto);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get('articles')
  @RequirePermissions(Permission.ARTICLE_CREATE)
  @ApiOperation({ summary: 'List articles authored by current user (incl. drafts)' })
  @ApiOkResponse({ type: [ArticleSummaryDto] })
  listMine(@CurrentUser() user: AuthUser): Promise<ArticleSummaryDto[]> {
    return this.articlesService.listMine(user.id);
  }

  @Get('articles/:id')
  @RequirePermissions(Permission.ARTICLE_CREATE)
  @ApiOperation({ summary: 'Get own article by id (for studio editor / drafts)' })
  @ApiOkResponse({ type: ArticleDetailDto })
  getMine(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ArticleDetailDto> {
    return this.articlesService.findMineById(id, user.id);
  }
}
