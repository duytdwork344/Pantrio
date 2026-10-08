import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { ModeratedFood, PendingRecipe } from '../../core/models';

function apiMessage(err: { error?: { message?: string | string[] }; message?: string }): string {
  const message = err.error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? err.message ?? 'Không tải được hàng đợi';
}

@Component({
  selector: 'app-moderation-page',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './moderation-page.component.html',
  styleUrl: './moderation-page.component.scss',
})
export class ModerationPageComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly pending = signal<PendingRecipe[]>([]);
  readonly orphans = signal<ModeratedFood[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/login');
      return;
    }
    if (!this.auth.canModerate()) {
      this.error.set('Tài khoản chưa có quyền moderation:manage.');
      this.loading.set(false);
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listPendingRecipes().subscribe({
      next: (rows) => {
        this.pending.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.loading.set(false);
        this.error.set(apiMessage(err));
      },
    });
    this.api.listOrphanFoods().subscribe({
      next: (rows) => this.orphans.set(rows),
      error: () => this.orphans.set([]),
    });
  }

  removeOrphan(food: ModeratedFood): void {
    this.api.deleteOrphanFood(food.id).subscribe({
      next: () => this.orphans.update((rows) => rows.filter((row) => row.id !== food.id)),
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.error.set(apiMessage(err));
      },
    });
  }
}
