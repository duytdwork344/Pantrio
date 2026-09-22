import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type {
  ArticleSummary,
  RecipeRecommendation,
  RecipeSummary,
} from '../../core/models';

@Component({
  selector: 'app-discover-page',
  imports: [RouterLink],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
})
export class DiscoverPageComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly recipes = signal<RecipeSummary[]>([]);
  readonly articles = signal<ArticleSummary[]>([]);
  readonly recommendations = signal<RecipeRecommendation[]>([]);
  readonly loading = signal(true);
  readonly recommendLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly recommendError = signal<string | null>(null);

  /** Max cards in the pantry strip on Discover. */
  readonly recommendLimit = 6;

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listRecipes().subscribe({
      next: (recipes) => {
        this.recipes.set(recipes);
        this.api.listArticles().subscribe({
          next: (articles) => {
            this.articles.set(articles);
            this.loading.set(false);
          },
          error: () => {
            this.articles.set([]);
            this.loading.set(false);
          },
        });
        this.loadRecommendations();
      },
      error: (err: { message?: string }) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Không tải được recipes');
      },
    });
  }

  matchLabel(row: RecipeRecommendation): string {
    if (row.canCook) {
      return 'Nấu được';
    }
    if (row.requiredCount <= 0) {
      return '';
    }
    return `${row.matchedCount}/${row.requiredCount} nguyên liệu`;
  }

  private loadRecommendations(): void {
    if (!this.auth.isAuthenticated()) {
      this.recommendations.set([]);
      this.recommendError.set(null);
      this.recommendLoading.set(false);
      return;
    }

    this.recommendLoading.set(true);
    this.recommendError.set(null);
    this.api.listPantryRecommendations().subscribe({
      next: (rows) => {
        const useful = rows.filter((r) => r.requiredCount > 0);
        this.recommendations.set(useful.slice(0, this.recommendLimit));
        this.recommendLoading.set(false);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.recommendations.set([]);
        this.recommendLoading.set(false);
        this.recommendError.set(
          err.error?.message ?? err.message ?? 'Không tải được gợi ý từ tủ',
        );
      },
    });
  }
}
