import {
  Body,
  Controller,
  Delete,
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
  SavedRecipeDto,
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

  @Post(':id/save')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save / bookmark a recipe for the current user' })
  @ApiOkResponse({
    schema: {
      properties: {
        saved: { type: 'boolean' },
        recipeId: { type: 'string' },
      },
    },
  })
  save(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.recipesService.saveRecipe(user.id, id);
  }

  @Delete(':id/save')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a recipe from saved list' })
  unsave(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.recipesService.unsaveRecipe(user.id, id);
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
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get recipe detail by slug (optional JWT adds saved + inInventory flags)',
  })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiNotFoundResponse({ description: 'Recipe not found' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<RecipeDetailDto> {
    const recipe = await this.recipesService.findBySlug(slug, user?.id);
    if (!recipe) {
      throw new NotFoundException(`Recipe '${slug}' not found`);
    }
    return recipe;
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get('saved-recipes')
  @ApiOperation({ summary: 'List recipes saved by the current user' })
  @ApiOkResponse({ type: [SavedRecipeDto] })
  listSaved(@CurrentUser() user: AuthUser): Promise<SavedRecipeDto[]> {
    return this.recipesService.listSavedRecipes(user.id);
  }
}
