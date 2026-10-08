import { NutrientGroup } from '@prisma/client';
import { convertQuantity } from '../units/convert';

export type NutrientMeta = {
  id: string;
  code: string;
  nameEn: string;
  nameVi: string;
  unit: string;
  group: NutrientGroup;
  sortOrder: number;
};

export type FoodNutrientRow = {
  amount: number;
  basisQty: number;
  basisUnit: string;
  nutrient: NutrientMeta;
};

export type NutrientContributionDto = {
  foodId: string;
  foodName: string;
  amount: number;
};

export type NutrientAmountDto = {
  code: string;
  nameEn: string;
  nameVi: string;
  unit: string;
  group: NutrientGroup;
  sortOrder: number;
  amount: number;
  complete: boolean;
  contributions: NutrientContributionDto[];
};

export type RecipeNutritionDto = {
  perServing: NutrientAmountDto[];
  total: NutrientAmountDto[];
  servings: number;
  /** True when every required ingredient has energy_kcal. */
  complete: boolean;
};

/** Codes shown on recipe/food MVP surfaces (catalog may seed more). */
export const MVP_NUTRITION_PROFILE = [
  'energy_kcal',
  'protein',
  'carb',
  'fat',
  'fiber',
  'sugar',
] as const;

export function mapFoodNutrients(rows: FoodNutrientRow[]) {
  return [...rows]
    .sort((a, b) => a.nutrient.sortOrder - b.nutrient.sortOrder)
    .map((row) => ({
      code: row.nutrient.code,
      nameEn: row.nutrient.nameEn,
      nameVi: row.nutrient.nameVi,
      unit: row.nutrient.unit,
      group: row.nutrient.group,
      sortOrder: row.nutrient.sortOrder,
      amount: row.amount,
      basisQty: row.basisQty,
      basisUnit: row.basisUnit,
    }));
}

export function aggregateRecipeNutrition(params: {
  servings: number;
  ingredients: Array<{
    foodId: string;
    foodName: string;
    quantity: number;
    unit: string;
    optional: boolean;
    nutrients: FoodNutrientRow[];
  }>;
}): RecipeNutritionDto | null {
  const servings = Math.max(params.servings, 1);
  const required = params.ingredients.filter((item) => !item.optional);
  const checkList = required.length ? required : params.ingredients;
  const contributors = params.ingredients.filter(
    (item) => item.nutrients.length > 0,
  );
  if (!contributors.length) {
    return null;
  }

  const totals = new Map<
    string,
    {
      meta: NutrientMeta;
      amount: number;
      presentInRequired: number;
      contributions: Map<string, NutrientContributionDto>;
    }
  >();

  for (const ingredient of params.ingredients) {
    for (const row of ingredient.nutrients) {
      const qtyInBasis = convertQuantity(
        ingredient.quantity,
        ingredient.unit,
        row.basisUnit,
      );
      if (qtyInBasis == null || row.basisQty <= 0) continue;
      const contribution = row.amount * (qtyInBasis / row.basisQty);
      if (contribution <= 0) continue;

      const existing = totals.get(row.nutrient.code);
      if (existing) {
        existing.amount += contribution;
        const prev = existing.contributions.get(ingredient.foodId);
        if (prev) {
          prev.amount += contribution;
        } else {
          existing.contributions.set(ingredient.foodId, {
            foodId: ingredient.foodId,
            foodName: ingredient.foodName,
            amount: contribution,
          });
        }
      } else {
        totals.set(row.nutrient.code, {
          meta: row.nutrient,
          amount: contribution,
          presentInRequired: 0,
          contributions: new Map([
            [
              ingredient.foodId,
              {
                foodId: ingredient.foodId,
                foodName: ingredient.foodName,
                amount: contribution,
              },
            ],
          ]),
        });
      }
    }
  }

  for (const ingredient of checkList) {
    const codes = new Set(ingredient.nutrients.map((row) => row.nutrient.code));
    for (const [code, entry] of totals) {
      if (codes.has(code)) entry.presentInRequired += 1;
    }
  }

  const requiredCount = checkList.length;
  const ranked = [...totals.values()].sort(
    (a, b) => a.meta.sortOrder - b.meta.sortOrder,
  );

  const total = ranked.map((entry) => {
    const contributions = [...entry.contributions.values()].sort(
      (a, b) => b.amount - a.amount,
    );
    return {
      code: entry.meta.code,
      nameEn: entry.meta.nameEn,
      nameVi: entry.meta.nameVi,
      unit: entry.meta.unit,
      group: entry.meta.group,
      sortOrder: entry.meta.sortOrder,
      amount: roundNutrient(entry.amount),
      complete:
        requiredCount > 0 && entry.presentInRequired === requiredCount,
      contributions: contributions.map((row) => ({
        foodId: row.foodId,
        foodName: row.foodName,
        amount: roundNutrient(row.amount),
      })),
    };
  });

  const perServing = ranked.map((entry, index) => {
    const base = total[index];
    const contributions = [...entry.contributions.values()].sort(
      (a, b) => b.amount - a.amount,
    );
    return {
      ...base,
      amount: roundNutrient(entry.amount / servings),
      contributions: contributions.map((row) => ({
        foodId: row.foodId,
        foodName: row.foodName,
        amount: roundNutrient(row.amount / servings),
      })),
    };
  });

  const complete = checkList.every((item) =>
    item.nutrients.some((row) => row.nutrient.code === 'energy_kcal'),
  );

  return {
    perServing,
    total,
    servings,
    complete,
  };
}

function roundNutrient(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 100) return Math.round(value);
  if (Math.abs(value) >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}
