export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
  roles: string[];
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  user: UserProfile;
};

export type RecipeSummary = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  servings: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  difficulty: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  shareCount?: number;
};

export type RecipeIngredient = {
  foodId: string;
  foodName: string;
  foodImageUrl?: string | null;
  quantity: number;
  unit: string;
  note?: string | null;
  optional: boolean;
  sortOrder: number;
  inInventory?: boolean;
};

export type RecipeStep = {
  id: string;
  sortOrder: number;
  body: string;
  imageUrl?: string | null;
};

export type RecipeDetail = RecipeSummary & {
  authorId: string;
  visibility: string;
  instructions: string;
  steps?: RecipeStep[];
  ingredients: RecipeIngredient[];
  contentVersion?: number | null;
  moderationStatus?: string | null;
  publishedVersion?: number | null;
  saved?: boolean;
  nutrition?: RecipeNutrition | null;
};

export type NutrientContribution = {
  foodId: string;
  foodName: string;
  amount: number;
};

export type NutrientAmount = {
  code: string;
  nameEn: string;
  nameVi: string;
  unit: string;
  group: string;
  sortOrder: number;
  amount: number;
  complete: boolean;
  contributions?: NutrientContribution[];
};

export type NutritionTargetComparison = {
  source: string;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  perServingPercent: Record<string, number | null>;
};

export type RecipeNutrition = {
  perServing: NutrientAmount[];
  total: NutrientAmount[];
  servings: number;
  complete: boolean;
  targetComparison?: NutritionTargetComparison;
};

export type NutritionTarget = {
  userId: string;
  sex: 'MALE' | 'FEMALE' | null;
  ageYears: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activity: string;
  source: string;
  presetCode: string | null;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  bmrKcal: number | null;
  updatedAt: string;
  disclaimer: string;
};

export type NutritionPreset = {
  code: string;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
};

export type FoodCandidate = {
  id: string;
  name: string;
  slug: string;
  visibility: string;
};

export type PrivateFoodReview = {
  foodId: string;
  name: string;
  slug: string;
  suggestions: FoodCandidate[];
};

export type ModerationRecipe = RecipeDetail & {
  privateFoods: PrivateFoodReview[];
};

export type PendingRecipe = {
  recipeId: string;
  slug: string;
  version: number;
  title: string;
  visibility: string;
  authorId: string;
  publishedVersion: number | null;
  submittedAt: string;
};

export type ModeratedFood = {
  id: string;
  slug: string;
  name: string;
  visibility: string;
  references: { total: number };
};

export type FoodHit = {
  id: string;
  slug: string;
  name: string;
  baseUnit: string;
  measurementType?: string;
  visibility?: string;
  nutrients?: FoodNutrientValue[];
};

export type NutrientCatalogItem = {
  id: string;
  code: string;
  nameEn: string;
  nameVi: string;
  unit: string;
  group: string;
  sortOrder: number;
};

export type FoodNutrientValue = {
  code: string;
  nameEn: string;
  nameVi: string;
  unit: string;
  group: string;
  sortOrder: number;
  amount: number;
  basisQty: number;
  basisUnit: string;
};

export type FoodDetail = {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  measurementType: string;
  baseUnit: string;
  visibility: string;
  nutrients?: FoodNutrientValue[];
};

/** Pantry recommend row from GET /recommendations/recipes */
export type RecipeRecommendation = {
  recipe: RecipeSummary;
  requiredCount: number;
  matchedCount: number;
  missingCount: number;
  canCook: boolean;
  missing: Array<{
    foodId: string;
    foodName: string;
    quantity: number;
    unit: string;
  }>;
};

export type ArticleSummary = {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  coverUrl?: string | null;
  publishedAt?: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  recipeCount?: number;
};

export type ArticleDetail = ArticleSummary & {
  body: string;
  updatedAt: string;
  recipes: RecipeSummary[];
};
