/** Daily nutrition target engine — requirements 7b.10 */

export type SexCode = 'MALE' | 'FEMALE';

export type ActivityCode =
  | 'SEDENTARY'
  | 'LIGHT'
  | 'MODERATE'
  | 'ACTIVE'
  | 'VERY_ACTIVE';

export type PresetCode =
  | 'CHILD_4_8'
  | 'CHILD_9_13'
  | 'TEEN_14_17'
  | 'ADULT_DEFAULT'
  | 'OLDER_65';

export type DailyMacroTarget = {
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
};

export type ComputedAdultTarget = DailyMacroTarget & {
  bmrKcal: number;
  source: 'COMPUTED';
};

export type PresetTarget = DailyMacroTarget & {
  bmrKcal: null;
  source: 'PRESET';
  presetCode: PresetCode;
};

export const ACTIVITY_MULTIPLIER: Record<ActivityCode, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export const NUTRITION_PRESETS: Record<PresetCode, DailyMacroTarget> = {
  CHILD_4_8: { energyKcal: 1400, proteinG: 70, fatG: 47, carbG: 175 },
  CHILD_9_13: { energyKcal: 1800, proteinG: 90, fatG: 60, carbG: 225 },
  TEEN_14_17: { energyKcal: 2200, proteinG: 110, fatG: 73, carbG: 275 },
  ADULT_DEFAULT: { energyKcal: 2000, proteinG: 100, fatG: 67, carbG: 250 },
  OLDER_65: { energyKcal: 1800, proteinG: 90, fatG: 60, carbG: 225 },
};

const MACRO_PCT = { protein: 0.2, fat: 0.3, carb: 0.5 } as const;

export function macrosFromTdee(tdee: number): DailyMacroTarget {
  const energyKcal = Math.round(tdee);
  return {
    energyKcal,
    proteinG: Math.round((energyKcal * MACRO_PCT.protein) / 4),
    fatG: Math.round((energyKcal * MACRO_PCT.fat) / 9),
    carbG: Math.round((energyKcal * MACRO_PCT.carb) / 4),
  };
}

export function computeBmr(params: {
  sex: SexCode;
  ageYears: number;
  weightKg: number;
  heightCm: number;
}): number {
  const { sex, ageYears, weightKg, heightCm } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'MALE' ? base + 5 : base - 161);
}

export function computeAdultDailyTarget(params: {
  sex: SexCode;
  ageYears: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityCode;
}): ComputedAdultTarget {
  if (params.ageYears < 18) {
    throw new Error('Mifflin compute requires ageYears >= 18');
  }
  const bmrKcal = computeBmr(params);
  const tdee = bmrKcal * ACTIVITY_MULTIPLIER[params.activity];
  return {
    ...macrosFromTdee(tdee),
    bmrKcal,
    source: 'COMPUTED',
  };
}

export function targetFromPreset(code: PresetCode): PresetTarget {
  return {
    ...NUTRITION_PRESETS[code],
    bmrKcal: null,
    source: 'PRESET',
    presetCode: code,
  };
}

/** Suggest preset when Mifflin is not applicable. */
export function suggestPresetForAge(ageYears: number): PresetCode {
  if (ageYears < 9) return 'CHILD_4_8';
  if (ageYears < 14) return 'CHILD_9_13';
  if (ageYears < 18) return 'TEEN_14_17';
  if (ageYears >= 65) return 'OLDER_65';
  return 'ADULT_DEFAULT';
}

export function percentOfDailyTarget(
  amount: number,
  targetDayAmount: number,
): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(targetDayAmount)) {
    return null;
  }
  if (targetDayAmount <= 0) return null;
  // One decimal place, e.g. 425/2000 → 21.3
  return Math.round((amount / targetDayAmount) * 1000) / 10;
}

export type DailyTargetAmounts = {
  energy_kcal: number;
  protein: number;
  fat: number;
  carb: number;
};

export function toDailyTargetAmounts(row: DailyMacroTarget): DailyTargetAmounts {
  return {
    energy_kcal: row.energyKcal,
    protein: row.proteinG,
    fat: row.fatG,
    carb: row.carbG,
  };
}

export function comparePerServingToDaily(
  perServing: Array<{ code: string; amount: number }>,
  daily: DailyTargetAmounts,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const item of perServing) {
    const key = item.code as keyof DailyTargetAmounts;
    if (key in daily) {
      out[item.code] = percentOfDailyTarget(item.amount, daily[key]);
    }
  }
  return out;
}
