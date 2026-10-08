import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type {
  FoodDetail,
  FoodHit,
  NutrientCatalogItem,
} from '../../core/models';

type AmountRow = {
  code: string;
  nameVi: string;
  nameEn: string;
  unit: string;
  group: string;
  sortOrder: number;
  amount: string;
};

const BASIS_UNITS = ['g', 'ml', 'pcs', 'kg', 'l'] as const;

function apiMessage(err: {
  error?: { message?: string | string[] };
  message?: string;
}): string {
  const message = err.error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? err.message ?? 'Có lỗi xảy ra';
}

function defaultBasis(food: FoodDetail): { qty: number; unit: string } {
  if (food.measurementType === 'COUNT') return { qty: 1, unit: 'pcs' };
  if (food.measurementType === 'VOLUME') return { qty: 100, unit: 'ml' };
  return { qty: 100, unit: 'g' };
}

@Component({
  selector: 'app-moderation-nutrition-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './moderation-nutrition-page.component.html',
  styleUrl: './moderation-nutrition-page.component.scss',
})
export class ModerationNutritionPageComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly catalog = signal<NutrientCatalogItem[]>([]);
  readonly foodQuery = signal('');
  readonly foodHits = signal<FoodHit[]>([]);
  readonly food = signal<FoodDetail | null>(null);
  readonly rows = signal<AmountRow[]>([]);
  readonly basisQty = signal('100');
  readonly basisUnit = signal<string>('g');
  readonly basisUnits = BASIS_UNITS;

  readonly loadingCatalog = signal(true);
  readonly loadingFood = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  constructor() {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/login');
      return;
    }
    if (!this.auth.canModerate()) {
      this.error.set('Tài khoản chưa có quyền moderation:manage.');
      this.loadingCatalog.set(false);
      return;
    }
    this.api.listNutrients().subscribe({
      next: (items) => {
        this.catalog.set(
          [...items].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        this.loadingCatalog.set(false);
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.loadingCatalog.set(false);
        this.error.set(apiMessage(err));
      },
    });
  }

  onFoodQuery(value: string): void {
    this.foodQuery.set(value);
    this.saved.set(false);
    const q = value.trim();
    if (q.length < 2) {
      this.foodHits.set([]);
      return;
    }
    this.api.searchFoods(q).subscribe({
      next: (hits) => this.foodHits.set(hits.slice(0, 10)),
      error: () => this.foodHits.set([]),
    });
  }

  pickFood(hit: FoodHit): void {
    this.foodQuery.set(hit.name);
    this.foodHits.set([]);
    this.saved.set(false);
    this.error.set(null);
    this.loadingFood.set(true);
    this.api.getFoodBySlug(hit.slug).subscribe({
      next: (food) => {
        this.applyFood(food);
        this.loadingFood.set(false);
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.loadingFood.set(false);
        this.error.set(apiMessage(err));
      },
    });
  }

  setAmount(code: string, value: string): void {
    this.rows.update((list) =>
      list.map((row) => (row.code === code ? { ...row, amount: value } : row)),
    );
    this.saved.set(false);
  }

  setBasisQty(value: string | number): void {
    this.basisQty.set(String(value));
    this.saved.set(false);
  }

  setBasisUnit(value: string): void {
    this.basisUnit.set(value);
    this.saved.set(false);
  }

  clearAmounts(): void {
    this.rows.update((list) => list.map((row) => ({ ...row, amount: '' })));
    this.saved.set(false);
  }

  save(): void {
    const food = this.food();
    if (!food) return;

    const qty = Number(this.basisQty());
    if (!Number.isFinite(qty) || qty <= 0) {
      this.error.set('Basis quantity phải > 0.');
      return;
    }

    const nutrients: Array<{
      code: string;
      amount: number;
      basisQty: number;
      basisUnit: string;
    }> = [];

    for (const row of this.rows()) {
      const raw = row.amount.trim();
      if (!raw) continue;
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        this.error.set(`Giá trị không hợp lệ cho ${row.nameVi} (${row.code}).`);
        return;
      }
      nutrients.push({
        code: row.code,
        amount,
        basisQty: qty,
        basisUnit: this.basisUnit(),
      });
    }

    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    this.api.replaceFoodNutrients(food.id, nutrients).subscribe({
      next: (updated) => {
        this.applyFood(updated);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.saving.set(false);
        this.error.set(apiMessage(err));
      },
    });
  }

  private applyFood(food: FoodDetail): void {
    this.food.set(food);
    const existing = new Map(
      (food.nutrients ?? []).map((row) => [row.code, row]),
    );
    const sample = food.nutrients?.[0];
    const fallback = defaultBasis(food);
    this.basisQty.set(String(sample?.basisQty ?? fallback.qty));
    this.basisUnit.set(sample?.basisUnit ?? fallback.unit);

    const catalog = this.catalog();
    const source = catalog.length
      ? catalog
      : (food.nutrients ?? []).map((row) => ({
          id: row.code,
          code: row.code,
          nameEn: row.nameEn,
          nameVi: row.nameVi,
          unit: row.unit,
          group: row.group,
          sortOrder: row.sortOrder,
        }));

    this.rows.set(
      source.map((item) => {
        const hit = existing.get(item.code);
        return {
          code: item.code,
          nameVi: item.nameVi,
          nameEn: item.nameEn,
          unit: item.unit,
          group: item.group,
          sortOrder: item.sortOrder,
          amount: hit != null ? String(hit.amount) : '',
        };
      }),
    );
  }
}
