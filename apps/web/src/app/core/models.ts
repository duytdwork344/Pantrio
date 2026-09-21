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
};

export type RecipeIngredient = {
  foodId: string;
  foodName: string;
  quantity: number;
  unit: string;
  note?: string | null;
  optional: boolean;
  sortOrder: number;
  inInventory?: boolean;
};

export type RecipeDetail = RecipeSummary & {
  authorId: string;
  visibility: string;
  instructions: string;
  ingredients: RecipeIngredient[];
  saved?: boolean;
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
