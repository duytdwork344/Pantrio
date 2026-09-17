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
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import { CreateFoodDto, FoodDto, UpdateFoodDto } from './dto/food.dto';

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
