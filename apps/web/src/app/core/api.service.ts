import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type {
  ArticleDetail,
  ArticleSummary,
  FoodHit,
  RecipeDetail,
  ModerationRecipe,
  ModeratedFood,
  PendingRecipe,
  RecipeRecommendation,
  RecipeSummary,
} from './models';

export type ArticleWriteBody = {
  title: string;
  summary?: string | null;
  body: string;
  coverUrl?: string | null;
  publish?: boolean;
  recipeIds?: string[];
};

export type RecipeWriteBody = {
  title: string;
  description?: string;
  servings: number;
  prepTimeMin?: number;
  cookTimeMin?: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  imageUrl?: string;
  steps: Array<{ body: string; imageUrl?: string; sortOrder: number }>;
  ingredients: Array<{
    foodId: string;
    quantity: number;
    unit: string;
    optional?: boolean;
    note?: string;
    sortOrder: number;
  }>;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listRecipes() {
    return this.http.get<RecipeSummary[]>(`${this.base}/recipes`);
  }

  searchRecipes(params: {
    q?: string;
    difficulty?: string;
    maxCookTimeMin?: number;
    limit?: number;
  } = {}) {
    const query = new URLSearchParams();
    if (params.q?.trim()) query.set('q', params.q.trim());
    if (params.difficulty) query.set('difficulty', params.difficulty);
    if (params.maxCookTimeMin != null) {
      query.set('maxCookTimeMin', String(params.maxCookTimeMin));
    }
    if (params.limit != null) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.http.get<RecipeSummary[]>(`${this.base}/search/recipes${suffix}`);
  }

  getRecipeBySlug(slug: string) {
    return this.http.get<RecipeDetail>(
      `${this.base}/recipes/${encodeURIComponent(slug)}`,
    );
  }

  shareRecipe(recipeId: string, channel: 'copy' | 'native' | 'unknown' = 'unknown') {
    return this.http.post<{
      recipeId: string;
      shareCount: number;
      channel: string;
      rateLimited?: boolean;
    }>(`${this.base}/recipes/${encodeURIComponent(recipeId)}/share`, {
      channel,
    });
  }

  /** Personal pantry recommend (auth + inventory:manage). Optional groupId later. */
  listPantryRecommendations(groupId?: string) {
    const params = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return this.http.get<RecipeRecommendation[]>(
      `${this.base}/recommendations/recipes${params}`,
    );
  }

  listArticles() {
    return this.http.get<ArticleSummary[]>(`${this.base}/articles`);
  }

  getArticleBySlug(slug: string) {
    return this.http.get<ArticleDetail>(
      `${this.base}/articles/${encodeURIComponent(slug)}`,
    );
  }

  listMyArticles() {
    return this.http.get<ArticleSummary[]>(`${this.base}/me/articles`);
  }

  getMyArticle(id: string) {
    return this.http.get<ArticleDetail>(`${this.base}/me/articles/${id}`);
  }

  createArticle(body: ArticleWriteBody) {
    return this.http.post<ArticleDetail>(`${this.base}/articles`, body);
  }

  updateArticle(id: string, body: Partial<ArticleWriteBody>) {
    return this.http.patch<ArticleDetail>(`${this.base}/articles/${id}`, body);
  }

  listMyRecipes() {
    return this.http.get<RecipeSummary[]>(`${this.base}/me/recipes`);
  }

  searchFoods(q: string, locale = 'vi') {
    const params = new URLSearchParams({ q, locale });
    return this.http.get<FoodHit[]>(`${this.base}/foods?${params.toString()}`);
  }

  uploadImage(file: File, folder = 'recipes') {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ url: string }>(
      `${this.base}/media?folder=${encodeURIComponent(folder)}`,
      body,
    );
  }

  createRecipe(body: RecipeWriteBody) {
    return this.http.post<RecipeDetail>(`${this.base}/recipes`, body);
  }

  updateRecipe(id: string, body: RecipeWriteBody) {
    return this.http.patch<RecipeDetail>(`${this.base}/recipes/${id}`, body);
  }

  listPendingRecipes() {
    return this.http.get<PendingRecipe[]>(`${this.base}/moderation/recipes`);
  }

  getModerationRecipe(id: string) {
    return this.http.get<ModerationRecipe>(
      `${this.base}/moderation/recipes/${encodeURIComponent(id)}`,
    );
  }

  approveRecipe(
    id: string,
    body: {
      version: number;
      foods?: Array<{
        foodId: string;
        action: 'promote' | 'merge';
        toFoodId?: string;
      }>;
    },
  ) {
    return this.http.post<ModerationRecipe>(
      `${this.base}/moderation/recipes/${encodeURIComponent(id)}/approve`,
      body,
    );
  }

  rejectRecipe(id: string, body: { version: number; reason?: string }) {
    return this.http.post<ModerationRecipe>(
      `${this.base}/moderation/recipes/${encodeURIComponent(id)}/reject`,
      body,
    );
  }

  listOrphanFoods() {
    return this.http.get<ModeratedFood[]>(
      `${this.base}/foods/moderation/orphans?locale=vi`,
    );
  }

  deleteOrphanFood(id: string) {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/foods/${encodeURIComponent(id)}`,
    );
  }
}
