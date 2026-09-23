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
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  CreateGroupRecipeDto,
  RecipeDetailDto,
  RecipeSummaryDto,
  UpdateGroupRecipeDto,
} from './dto/recipe.dto';
import { RecipesService } from './recipes.service';

/**
 * Group cookbook — requirements 4.2c.
 * Any group member may create; author or OWNER may update/delete.
 * No CREATOR / recipe:create required.
 */
@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups/me/recipes')
export class GroupRecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @ApiOperation({ summary: 'List group cookbook recipes for current membership' })
  @ApiOkResponse({ type: [RecipeSummaryDto] })
  list(@CurrentUser() user: AuthUser): Promise<RecipeSummaryDto[]> {
    return this.recipesService.listGroupCookbook(user.id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a group cookbook recipe (any member; visibility forced to GROUP)',
  })
  @ApiOkResponse({ type: RecipeDetailDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroupRecipeDto,
  ): Promise<RecipeDetailDto> {
    return this.recipesService.createForGroup(user, dto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a group cookbook recipe by slug' })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiNotFoundResponse({ description: 'Recipe not found in your group' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RecipeDetailDto> {
    const recipe = await this.recipesService.findGroupBySlug(user.id, slug);
    if (!recipe) {
      throw new NotFoundException(`Group recipe '${slug}' not found`);
    }
    return recipe;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update group cookbook recipe (author or group OWNER)',
  })
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiNotFoundResponse({ description: 'Recipe not found' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGroupRecipeDto,
  ): Promise<RecipeDetailDto> {
    return this.recipesService.updateForGroup(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete group cookbook recipe (author or group OWNER)',
  })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.recipesService.deleteForGroup(id, user);
  }
}
