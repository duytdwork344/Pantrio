import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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
import {
  CreatePlannedRecipeDto,
  PlannedRecipeDto,
  UpdatePlannedRecipeDto,
} from './dto/planned-recipe.dto';
import { PlanningService } from './planning.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me/planned-recipes')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get()
  @ApiOperation({ summary: 'List planned recipes for current user' })
  @ApiOkResponse({ type: [PlannedRecipeDto] })
  list(@CurrentUser() user: AuthUser): Promise<PlannedRecipeDto[]> {
    return this.planningService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Plan a recipe with servings (and optional date)' })
  @ApiOkResponse({ type: PlannedRecipeDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePlannedRecipeDto,
  ): Promise<PlannedRecipeDto> {
    return this.planningService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update planned servings / plannedFor' })
  @ApiOkResponse({ type: PlannedRecipeDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlannedRecipeDto,
  ): Promise<PlannedRecipeDto> {
    return this.planningService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a planned recipe' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.planningService.remove(user.id, id);
  }
}
