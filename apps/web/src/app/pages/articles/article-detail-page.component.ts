import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import type { ArticleDetail } from '../../core/models';

@Component({
  selector: 'app-article-detail-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './article-detail-page.component.html',
  styleUrl: './article-detail-page.component.scss',
})
export class ArticleDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly article = signal<ArticleDetail | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.getArticleBySlug(params.get('slug') ?? '');
        }),
      )
      .subscribe({
        next: (article) => {
          this.article.set(article);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.article.set(null);
          this.loading.set(false);
          this.error.set(
            err.error?.message ?? err.message ?? 'Không tải được article',
          );
        },
      });
  }
}
