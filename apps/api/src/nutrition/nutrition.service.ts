import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLevel,
  NutritionTargetSource,
  type UserNutritionTarget,
} from '@prisma/client';
import {
  NUTRITION_PRESETS,
  comparePerServingToDaily,
  computeAdultDailyTarget,
  suggestPresetForAge,
  targetFromPreset,
  toDailyTargetAmounts,
  type PresetCode,
} from '../common/nutrition/targets';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplyPresetNutritionTargetDto,
  ComputeNutritionTargetDto,
  ManualNutritionTargetDto,
  NutritionTargetComparisonDto,
  NutritionTargetDto,
} from './dto/nutrition-target.dto';

export const NUTRITION_DISCLAIMER =
  'Ước lượng dinh dưỡng mang tính tham khảo, không thay thế tư vấn y tế hay chuyên gia dinh dưỡng.';

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string): Promise<NutritionTargetDto | null> {
    const row = await this.prisma.userNutritionTarget.findUnique({
      where: { userId },
    });
    return row ? this.toDto(row) : null;
  }

  async computeAndSave(
    userId: string,
    dto: ComputeNutritionTargetDto,
  ): Promise<NutritionTargetDto> {
    const activity = dto.activity ?? ActivityLevel.MODERATE;

    if (dto.ageYears < 18) {
      throw new BadRequestException(
        `Age under 18 cannot use Mifflin. Apply a preset (e.g. ${suggestPresetForAge(dto.ageYears)}) via PUT /me/nutrition-target/preset`,
      );
    }

    const computed = computeAdultDailyTarget({
      sex: dto.sex,
      ageYears: dto.ageYears,
      weightKg: dto.weightKg,
      heightCm: dto.heightCm,
      activity,
    });

    const row = await this.prisma.userNutritionTarget.upsert({
      where: { userId },
      create: {
        userId,
        sex: dto.sex,
        ageYears: dto.ageYears,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        activity,
        source: NutritionTargetSource.COMPUTED,
        presetCode: null,
        energyKcal: computed.energyKcal,
        proteinG: computed.proteinG,
        fatG: computed.fatG,
        carbG: computed.carbG,
        bmrKcal: computed.bmrKcal,
      },
      update: {
        sex: dto.sex,
        ageYears: dto.ageYears,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        activity,
        source: NutritionTargetSource.COMPUTED,
        presetCode: null,
        energyKcal: computed.energyKcal,
        proteinG: computed.proteinG,
        fatG: computed.fatG,
        carbG: computed.carbG,
        bmrKcal: computed.bmrKcal,
      },
    });

    return this.toDto(row);
  }

  async applyPreset(
    userId: string,
    dto: ApplyPresetNutritionTargetDto,
  ): Promise<NutritionTargetDto> {
    const preset = targetFromPreset(dto.presetCode);
    const existing = await this.prisma.userNutritionTarget.findUnique({
      where: { userId },
    });

    const row = await this.prisma.userNutritionTarget.upsert({
      where: { userId },
      create: {
        userId,
        sex: existing?.sex ?? null,
        ageYears: existing?.ageYears ?? null,
        weightKg: existing?.weightKg ?? null,
        heightCm: existing?.heightCm ?? null,
        activity: existing?.activity ?? ActivityLevel.MODERATE,
        source: NutritionTargetSource.PRESET,
        presetCode: dto.presetCode,
        energyKcal: preset.energyKcal,
        proteinG: preset.proteinG,
        fatG: preset.fatG,
        carbG: preset.carbG,
        bmrKcal: null,
      },
      update: {
        source: NutritionTargetSource.PRESET,
        presetCode: dto.presetCode,
        energyKcal: preset.energyKcal,
        proteinG: preset.proteinG,
        fatG: preset.fatG,
        carbG: preset.carbG,
        bmrKcal: null,
      },
    });

    return this.toDto(row);
  }

  async saveManual(
    userId: string,
    dto: ManualNutritionTargetDto,
  ): Promise<NutritionTargetDto> {
    const existing = await this.prisma.userNutritionTarget.findUnique({
      where: { userId },
    });

    const row = await this.prisma.userNutritionTarget.upsert({
      where: { userId },
      create: {
        userId,
        sex: dto.sex ?? null,
        ageYears: dto.ageYears ?? null,
        weightKg: dto.weightKg ?? null,
        heightCm: dto.heightCm ?? null,
        activity: dto.activity ?? ActivityLevel.MODERATE,
        source: NutritionTargetSource.MANUAL,
        presetCode: null,
        energyKcal: dto.energyKcal,
        proteinG: dto.proteinG,
        fatG: dto.fatG,
        carbG: dto.carbG,
        bmrKcal: null,
      },
      update: {
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.ageYears !== undefined ? { ageYears: dto.ageYears } : {}),
        ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
        ...(dto.heightCm !== undefined ? { heightCm: dto.heightCm } : {}),
        ...(dto.activity !== undefined ? { activity: dto.activity } : {}),
        source: NutritionTargetSource.MANUAL,
        presetCode: null,
        energyKcal: dto.energyKcal,
        proteinG: dto.proteinG,
        fatG: dto.fatG,
        carbG: dto.carbG,
        bmrKcal: existing?.source === NutritionTargetSource.COMPUTED
          ? existing.bmrKcal
          : null,
      },
    });

    return this.toDto(row);
  }

  async comparisonForUser(
    userId: string,
    perServing: Array<{ code: string; amount: number }>,
  ): Promise<NutritionTargetComparisonDto | null> {
    const row = await this.prisma.userNutritionTarget.findUnique({
      where: { userId },
    });
    if (!row) return null;

    const daily = toDailyTargetAmounts(row);
    return {
      source: row.source,
      energyKcal: row.energyKcal,
      proteinG: row.proteinG,
      fatG: row.fatG,
      carbG: row.carbG,
      perServingPercent: comparePerServingToDaily(perServing, daily),
    };
  }

  async requireMine(userId: string): Promise<NutritionTargetDto> {
    const dto = await this.getMine(userId);
    if (!dto) {
      throw new NotFoundException('Nutrition target not set');
    }
    return dto;
  }

  listPresets() {
    return (Object.keys(NUTRITION_PRESETS) as PresetCode[]).map((code) => {
      const t = targetFromPreset(code);
      return {
        code,
        energyKcal: t.energyKcal,
        proteinG: t.proteinG,
        fatG: t.fatG,
        carbG: t.carbG,
      };
    });
  }

  private toDto(row: UserNutritionTarget): NutritionTargetDto {
    return {
      userId: row.userId,
      sex: row.sex,
      ageYears: row.ageYears,
      weightKg: row.weightKg,
      heightCm: row.heightCm,
      activity: row.activity,
      source: row.source,
      presetCode: row.presetCode,
      energyKcal: row.energyKcal,
      proteinG: row.proteinG,
      fatG: row.fatG,
      carbG: row.carbG,
      bmrKcal: row.bmrKcal,
      updatedAt: row.updatedAt,
      disclaimer: NUTRITION_DISCLAIMER,
    };
  }
}
