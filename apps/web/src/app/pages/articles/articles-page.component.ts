import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { ArticleSummary } from '../../core/models';

@Component({
  selector: 'app-articles-page',
  imports: [RouterLink],
  templateUrl: './articles-page.component.html',
  styleUrl: './articles-page.component.scss',
})
export class ArticlesPageComponent {
  private readonly api = inject(ApiService);
  readonly articles = signal<ArticleSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listArticles().subscribe({
      next: (rows) => {
        this.articles.set(rows);
        this.loading.set(false);
      },
      error: (err: { message?: string }) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Không tải được articles');
      },
    });
  }
}
