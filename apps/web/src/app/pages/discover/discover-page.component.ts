import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { ArticleSummary, RecipeSummary } from '../../core/models';

@Component({
  selector: 'app-discover-page',
  imports: [RouterLink],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
})
export class DiscoverPageComponent {
  private readonly api = inject(ApiService);

  readonly recipes = signal<RecipeSummary[]>([]);
  readonly articles = signal<ArticleSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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
            // Articles API may not be up yet during staged rollout.
            this.articles.set([]);
            this.loading.set(false);
          },
        });
      },
      error: (err: { message?: string }) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Không tải được recipes');
      },
    });
  }
}
