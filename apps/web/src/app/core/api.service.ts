import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type {
  ArticleDetail,
  ArticleSummary,
  RecipeDetail,
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

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listRecipes() {
    return this.http.get<RecipeSummary[]>(`${this.base}/recipes`);
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
}
