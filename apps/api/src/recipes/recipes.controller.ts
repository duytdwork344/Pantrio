import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RecipeDetailDto, RecipeSummaryDto } from './dto/recipe.dto';
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
