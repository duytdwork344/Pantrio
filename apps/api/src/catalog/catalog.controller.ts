import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@pantrio/shared';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CatalogService } from './catalog.service';
import { CreateFoodDto, FoodDto, UpdateFoodDto } from './dto/food.dto';

@ApiTags('catalog')
@Controller('foods')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List / search food master catalog' })
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
  ): Promise<FoodDto[]> {
    return this.catalogService.list({ q, category, locale });
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get food by slug' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  findBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.findBySlug(slug, locale);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a food master item with translations' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  create(
    @Body() dto: CreateFoodDto,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.create(dto, locale);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update food fields and/or upsert translations' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: FoodDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFoodDto,
    @Query('locale') locale?: string,
  ): Promise<FoodDto> {
    return this.catalogService.update(id, dto, locale);
  }
}
