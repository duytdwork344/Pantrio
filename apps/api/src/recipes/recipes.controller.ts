import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
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
  CreateRecipeDto,
  RecipeDetailDto,
  RecipeSummaryDto,
  UpdateRecipeDto,
} from './dto/recipe.dto';
import { RecipesService } from './recipes.service';

@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List public recipes for discovery' })
  @ApiOkResponse({ type: [RecipeSummaryDto] })
  list(): Promise<RecipeSummaryDto[]> {
    return this.recipesService.list();
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermissions(Permission.RECIPE_CREATE)
  @ApiOperation({ summary: 'Create a recipe with ingredients (CREATOR)' })
  @ApiOkResponse({ type: RecipeDetailDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRecipeDto,
  ): Promise<RecipeDetailDto> {
    return this.recipesService.create(user, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions(Permission.RECIPE_UPDATE)
  @ApiOperation({
    summary: 'Update recipe (author, or elevated moderation/system)',
  })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiNotFoundResponse({ description: 'Recipe not found' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRecipeDto,
  ): Promise<RecipeDetailDto> {
    return this.recipesService.update(id, user, dto);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get recipe detail by slug' })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiNotFoundResponse({ description: 'Recipe not found' })
  async findBySlug(@Param('slug') slug: string): Promise<RecipeDetailDto> {
    const recipe = await this.recipesService.findBySlug(slug);
    if (!recipe) {
      throw new NotFoundException(`Recipe '${slug}' not found`);
    }
    return recipe;
  }
}
