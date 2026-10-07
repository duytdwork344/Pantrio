import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [RouterLink, FormsModule],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
})
export class DiscoverPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly recipes = signal<RecipeSummary[]>([]);
  readonly articles = signal<ArticleSummary[]>([]);
  readonly recommendations = signal<RecipeRecommendation[]>([]);
  readonly loading = signal(true);
  readonly searching = signal(false);
  readonly recommendLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly recommendError = signal<string | null>(null);
  readonly query = signal('');
  readonly difficulty = signal('');
  readonly maxCookTimeMin = signal('');

  /** Max cards in the pantry strip on Discover. */
  readonly recommendLimit = 6;

  private searchTimeout: any;
  private currentSearchVersion = 0;

  constructor() {
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.loadRecipes();
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
  }

  search(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searching.set(true);
    this.error.set(null);
    this.loadRecipes(() => this.searching.set(false));
  }

  onFilterChange(delay = 400): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.search();
    }, delay);
  }

  clearSearch(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.query.set('');
    this.difficulty.set('');
    this.maxCookTimeMin.set('');
    this.search();
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

  private loadRecipes(done?: () => void): void {
    const q = this.query().trim();
    const difficulty = this.difficulty();
    const maxCookRaw = this.maxCookTimeMin().trim();
    const maxCookTimeMin = maxCookRaw ? Number(maxCookRaw) : undefined;
    const version = ++this.currentSearchVersion;

    const request =
      q || difficulty || maxCookTimeMin != null
        ? this.api.searchRecipes({
            q: q || undefined,
            difficulty: difficulty || undefined,
            maxCookTimeMin:
              maxCookTimeMin != null && Number.isFinite(maxCookTimeMin)
                ? maxCookTimeMin
                : undefined,
          })
        : this.api.listRecipes();

    request.subscribe({
      next: (recipes) => {
        if (version !== this.currentSearchVersion) return;
        this.recipes.set(recipes);
        done?.();
      },
      error: (err: { message?: string }) => {
        if (version !== this.currentSearchVersion) return;
        this.error.set(err.message ?? 'Không tải được recipes');
        done?.();
      },
    });
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
