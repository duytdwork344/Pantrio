import { Body, Controller, Get, Put } from '@nestjs/common';
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
  ApplyPresetNutritionTargetDto,
  ComputeNutritionTargetDto,
  ManualNutritionTargetDto,
  NutritionTargetDto,
} from './dto/nutrition-target.dto';
import { NutritionService } from './nutrition.service';

@ApiTags('nutrition')
@ApiBearerAuth()
@Controller('me/nutrition-target')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('presets')
  @ApiOperation({ summary: 'List available nutrition presets' })
  listPresets() {
    return this.nutritionService.listPresets();
  }

  @Get()
  @ApiOperation({ summary: 'Get current user daily nutrition target' })
  @ApiOkResponse({ type: NutritionTargetDto })
  getMine(@CurrentUser() user: AuthUser): Promise<NutritionTargetDto | null> {
    return this.nutritionService.getMine(user.id);
  }

  @Put('compute')
  @ApiOperation({
    summary:
      'Compute Mifflin–St Jeor target from biometrics and save (age >= 18)',
  })
  @ApiOkResponse({ type: NutritionTargetDto })
  compute(
    @CurrentUser() user: AuthUser,
    @Body() dto: ComputeNutritionTargetDto,
  ): Promise<NutritionTargetDto> {
    return this.nutritionService.computeAndSave(user.id, dto);
  }

  @Put('preset')
  @ApiOperation({ summary: 'Apply a fixed daily preset (child / fallback)' })
  @ApiOkResponse({ type: NutritionTargetDto })
  preset(
    @CurrentUser() user: AuthUser,
    @Body() dto: ApplyPresetNutritionTargetDto,
  ): Promise<NutritionTargetDto> {
    return this.nutritionService.applyPreset(user.id, dto);
  }

  @Put()
  @ApiOperation({ summary: 'Manually set daily macro targets' })
  @ApiOkResponse({ type: NutritionTargetDto })
  manual(
    @CurrentUser() user: AuthUser,
    @Body() dto: ManualNutritionTargetDto,
  ): Promise<NutritionTargetDto> {
    return this.nutritionService.saveManual(user.id, dto);
  }

}
