import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateFoodDto,
  FoodDto,
  MergeFoodDto,
  MergeFoodResultDto,
  ModeratedFoodDto,
  NutrientDto,
  ReplaceFoodNutrientsDto,
  UpdateFoodDto,
} from './dto/food.dto';

@ApiTags('catalog')
@Controller('foods')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List / search foods (PUBLIC; + own PRIVATE with JWT; managers see all)',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name/slug' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({
    name: 'locale',
    required: false,
    description: 'Content locale (vi|en). Defaults to vi',
  })
  @ApiOkResponse({ type: [FoodDto] })
  list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('locale') locale?: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<FoodDto[]> {
    return this.catalogService.list({ q, category, locale, viewer: user });
  }

  @Get('moderation/private')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Moderator: list PRIVATE foods with reference counts',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: [ModeratedFoodDto] })
  listPrivate(
    @CurrentUser() user: AuthUser,
    @Query('locale') locale?: string,
  ): Promise<ModeratedFoodDto[]> {
    return this.catalogService.listPrivateForModeration(user, locale);
  }

  @Get('moderation/orphans')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Moderator: list PRIVATE foods with zero references (safe to delete)',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: [ModeratedFoodDto] })
  listOrphans(
    @CurrentUser() user: AuthUser,
    @Query('locale') locale?: string,
  ): Promise<ModeratedFoodDto[]> {
    return this.catalogService.listOrphansForModeration(user, locale);
  }

  @Post('moderation/merge')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Moderator: merge fromFoodId → toFoodId (remap FKs, delete from; toFood auto-promoted to PUBLIC)',
  })
  @ApiOkResponse({ type: MergeFoodResultDto })
  merge(
    @CurrentUser() user: AuthUser,
    @Body() dto: MergeFoodDto,
  ): Promise<MergeFoodResultDto> {
    return this.catalogService.merge(user, dto);
  }

  @Post(':id/promote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderator: promote PRIVATE food → PUBLIC' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  promote(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.promote(id, user, locale);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Moderator: delete PRIVATE orphan food only (total references must be 0)',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalogService.deleteOrphan(id, user);
  }

  @Get('nutrients')
  @Public()
  @ApiOperation({ summary: 'List nutrient catalog (code, unit, group)' })
  @ApiOkResponse({ type: [NutrientDto] })
  listNutrients(): Promise<NutrientDto[]> {
    return this.catalogService.listNutrients();
  }

  @Put(':id/nutrients')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replace FoodNutrient rows for a food (catalog/moderation manager)',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  replaceNutrients(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplaceFoodNutrientsDto,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.replaceFoodNutrients(id, user, dto, locale);
  }

  @Public()
  @Get(':slug')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get food by slug (respects PUBLIC / PRIVATE visibility)',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  findBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<FoodDto> {
    return this.catalogService.findBySlug(slug, locale, user);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create food. Without catalog:manage → always PRIVATE. Managers may create PUBLIC.',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFoodDto,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.create(dto, user, locale);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update food (owner of PRIVATE, or catalog/moderation manager). Promote visibility requires manager.',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateFoodDto,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.update(id, dto, user, locale);
  }
}
