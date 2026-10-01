import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { FoodHit, ModerationRecipe } from '../../core/models';

type FoodDecision = { action: 'promote' | 'merge'; toFoodId?: string };

function apiMessage(err: { error?: { message?: string | string[] }; message?: string }): string {
  const message = err.error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? err.message ?? 'Không duyệt được recipe';
}

@Component({
  selector: 'app-moderation-review-page',
  imports: [RouterLink],
  templateUrl: './moderation-review-page.component.html',
  styleUrl: './moderation-review-page.component.scss',
})
export class ModerationReviewPageComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly recipe = signal<ModerationRecipe | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly reason = signal('');
  readonly decisions = signal<Record<string, FoodDecision>>({});
  readonly extraHits = signal<Record<string, FoodHit[]>>({});
  readonly queries = signal<Record<string, string>>({});

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
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Thiếu recipe.');
      this.loading.set(false);
      return;
    }
    this.load(id);
  }

  private load(id: string): void {
    this.api.getModerationRecipe(id).subscribe({
      next: (row) => {
        this.recipe.set(row);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.loading.set(false);
        this.error.set(apiMessage(err));
      },
    });
  }

  queryOf(foodId: string): string {
    return this.queries()[foodId] ?? '';
  }

  hitsOf(foodId: string): FoodHit[] {
    return this.extraHits()[foodId] ?? [];
  }

  choice(foodId: string): string {
    const decision = this.decisions()[foodId];
    if (!decision) return '';
    if (decision.action === 'promote') return 'promote';
    return `merge:${decision.toFoodId ?? ''}`;
  }

  choose(foodId: string, value: string): void {
    if (value === 'promote') {
      this.decisions.update((current) => ({
        ...current,
        [foodId]: { action: 'promote' },
      }));
      return;
    }
    const toFoodId = value.replace(/^merge:/, '');
    this.decisions.update((current) => ({
      ...current,
      [foodId]: { action: 'merge', toFoodId },
    }));
  }

  setQuery(foodId: string, value: string): void {
    this.queries.update((current) => ({ ...current, [foodId]: value }));
  }

  search(foodId: string): void {
    const q = (this.queries()[foodId] ?? '').trim();
    if (q.length < 2) return;
    this.api.searchFoods(q, 'vi').subscribe({
      next: (hits) => {
        this.extraHits.update((current) => ({
          ...current,
          [foodId]: hits.filter((hit) => hit.id !== foodId),
        }));
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.error.set(apiMessage(err));
      },
    });
  }

  unresolved(): boolean {
    const recipe = this.recipe();
    if (!recipe) return true;
    return recipe.privateFoods.some(
      (food) => food.suggestions.length > 0 && !this.decisions()[food.foodId],
    );
  }

  approve(): void {
    const recipe = this.recipe();
    if (!recipe || recipe.contentVersion == null || this.unresolved()) return;
    const foods = recipe.privateFoods.flatMap((food) => {
      const decision = this.decisions()[food.foodId];
      if (!decision) return [];
      return [
        {
          foodId: food.foodId,
          action: decision.action,
          ...(decision.toFoodId ? { toFoodId: decision.toFoodId } : {}),
        },
      ];
    });
    this.saving.set(true);
    this.error.set(null);
    this.api
      .approveRecipe(recipe.id, { version: recipe.contentVersion, foods })
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigateByUrl('/moderation');
        },
        error: (err: { error?: { message?: string | string[] }; message?: string }) => {
          this.saving.set(false);
          this.error.set(apiMessage(err));
        },
      });
  }

  reject(): void {
    const recipe = this.recipe();
    if (!recipe || recipe.contentVersion == null) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .rejectRecipe(recipe.id, {
        version: recipe.contentVersion,
        reason: this.reason().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigateByUrl('/moderation');
        },
        error: (err: { error?: { message?: string | string[] }; message?: string }) => {
          this.saving.set(false);
          this.error.set(apiMessage(err));
        },
      });
  }
}
