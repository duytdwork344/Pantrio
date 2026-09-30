import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { RecipeSummary } from '../../core/models';

@Component({
  selector: 'app-studio-recipes-page',
  imports: [RouterLink],
  templateUrl: './studio-recipes-page.component.html',
  styleUrl: './studio-recipes-page.component.scss',
})
export class StudioRecipesPageComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mine = signal<RecipeSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/login');
      return;
    }
    if (!this.auth.canCreateRecipe()) {
      this.error.set('Tài khoản chưa có quyền recipe:create (cần CREATOR).');
      this.loading.set(false);
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listMyRecipes().subscribe({
      next: (rows) => {
        this.mine.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message ?? err.message ?? 'Không tải được recipe của bạn',
        );
      },
    });
  }
}
