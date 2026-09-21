import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import type { RecipeDetail } from '../../core/models';

@Component({
  selector: 'app-recipe-detail-page',
  imports: [RouterLink],
  templateUrl: './recipe-detail-page.component.html',
  styleUrl: './recipe-detail-page.component.scss',
})
export class RecipeDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly recipe = signal<RecipeDetail | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const slug = params.get('slug') ?? '';
          this.loading.set(true);
          this.error.set(null);
          return this.api.getRecipeBySlug(slug);
        }),
      )
      .subscribe({
        next: (recipe) => {
          this.recipe.set(recipe);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.recipe.set(null);
          this.loading.set(false);
          this.error.set(
            err.error?.message ?? err.message ?? 'Không tải được recipe',
          );
        },
      });
  }
}
