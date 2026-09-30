import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { FoodHit } from '../../core/models';

type DraftIngredient = {
  key: number;
  foodId: string;
  foodName: string;
  quantity: number;
  unit: string;
  optional: boolean;
  note: string;
};

type DraftStep = {
  key: number;
  body: string;
  imageUrl: string | null;
  previewUrl: string | null;
  file: File | null;
};

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs'] as const;

@Component({
  selector: 'app-studio-recipe-editor-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './studio-recipe-editor-page.component.html',
  styleUrl: './studio-recipe-editor-page.component.scss',
})
export class StudioRecipeEditorPageComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private nextKey = 1;

  readonly units = UNITS;
  readonly recipeId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly foodQuery = signal('');
  readonly foodHits = signal<FoodHit[]>([]);
  readonly ingredients = signal<DraftIngredient[]>([]);
  readonly steps = signal<DraftStep[]>([]);
  readonly coverUrl = signal<string | null>(null);
  readonly coverPreview = signal<string | null>(null);
  private coverFile: File | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    servings: [2, [Validators.required, Validators.min(1)]],
    prepTimeMin: [''],
    cookTimeMin: [''],
    difficulty: ['EASY' as 'EASY' | 'MEDIUM' | 'HARD'],
    visibility: ['PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'UNLISTED'],
  });

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

    this.ingredients.set([this.blankIngredient()]);
    this.steps.set([this.blankStep()]);

    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug || slug === 'new') {
      this.loading.set(false);
      return;
    }

    this.api.getRecipeBySlug(slug).subscribe({
      next: (recipe) => {
        if (recipe.authorId !== this.auth.user()?.id) {
          this.error.set('Chỉ tác giả mới sửa được recipe này.');
          this.loading.set(false);
          return;
        }
        this.recipeId.set(recipe.id);
        this.form.patchValue({
          title: recipe.title,
          description: recipe.description ?? '',
          servings: recipe.servings,
          prepTimeMin: recipe.prepTimeMin?.toString() ?? '',
          cookTimeMin: recipe.cookTimeMin?.toString() ?? '',
          difficulty: this.asDifficulty(recipe.difficulty),
          visibility: this.asVisibility(recipe.visibility),
        });
        this.coverUrl.set(recipe.imageUrl ?? null);
        this.coverPreview.set(recipe.imageUrl ?? null);
        this.ingredients.set(
          recipe.ingredients.length
            ? recipe.ingredients.map((ing) => ({
                key: this.nextKey++,
                foodId: ing.foodId,
                foodName: ing.foodName,
                quantity: ing.quantity,
                unit: UNITS.includes(ing.unit as (typeof UNITS)[number])
                  ? ing.unit
                  : 'g',
                optional: ing.optional,
                note: ing.note ?? '',
              }))
            : [this.blankIngredient()],
        );
        const steps = recipe.steps ?? [];
        this.steps.set(
          steps.length
            ? steps.map((step) => ({
                key: this.nextKey++,
                body: step.body,
                imageUrl: step.imageUrl ?? null,
                previewUrl: step.imageUrl ?? null,
                file: null,
              }))
            : recipe.instructions
              ? recipe.instructions
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((body) => ({
                    key: this.nextKey++,
                    body,
                    imageUrl: null,
                    previewUrl: null,
                    file: null,
                  }))
              : [this.blankStep()],
        );
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message ?? err.message ?? 'Không tải được recipe',
        );
      },
    });
  }

  onFoodQuery(value: string): void {
    this.foodQuery.set(value);
    const q = value.trim();
    if (q.length < 2) {
      this.foodHits.set([]);
      return;
    }
    this.api.searchFoods(q).subscribe({
      next: (hits) => this.foodHits.set(hits.slice(0, 8)),
      error: () => this.foodHits.set([]),
    });
  }

  pickFood(food: FoodHit): void {
    const rows = this.ingredients();
    const empty = rows.find((row) => !row.foodId);
    if (empty) {
      this.ingredients.set(
        rows.map((row) =>
          row.key === empty.key
            ? {
                ...row,
                foodId: food.id,
                foodName: food.name,
                unit: UNITS.includes(food.baseUnit as (typeof UNITS)[number])
                  ? food.baseUnit
                  : row.unit,
              }
            : row,
        ),
      );
    } else {
      this.ingredients.set([
        ...rows,
        {
          ...this.blankIngredient(),
          foodId: food.id,
          foodName: food.name,
          unit: UNITS.includes(food.baseUnit as (typeof UNITS)[number])
            ? food.baseUnit
            : 'g',
        },
      ]);
    }
    this.foodQuery.set('');
    this.foodHits.set([]);
  }

  addIngredient(): void {
    this.ingredients.set([...this.ingredients(), this.blankIngredient()]);
  }

  removeIngredient(key: number): void {
    const rows = this.ingredients().filter((row) => row.key !== key);
    this.ingredients.set(rows.length ? rows : [this.blankIngredient()]);
  }

  patchIngredient(key: number, patch: Partial<DraftIngredient>): void {
    this.ingredients.set(
      this.ingredients().map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    );
  }

  addStep(): void {
    this.steps.set([...this.steps(), this.blankStep()]);
  }

  removeStep(key: number): void {
    const rows = this.steps().filter((row) => row.key !== key);
    this.steps.set(rows.length ? rows : [this.blankStep()]);
  }

  patchStep(key: number, body: string): void {
    this.steps.set(
      this.steps().map((step) => (step.key === key ? { ...step, body } : step)),
    );
  }

  onStepImage(key: number, file: File | null): void {
    this.steps.set(
      this.steps().map((step) => {
        if (step.key !== key) return step;
        if (step.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(step.previewUrl);
        }
        return {
          ...step,
          file,
          previewUrl: file ? URL.createObjectURL(file) : step.imageUrl,
        };
      }),
    );
  }

  onCover(file: File | null): void {
    if (this.coverPreview()?.startsWith('blob:')) {
      URL.revokeObjectURL(this.coverPreview()!);
    }
    this.coverFile = file;
    this.coverPreview.set(file ? URL.createObjectURL(file) : this.coverUrl());
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const steps = this.steps()
      .map((step) => ({ ...step, body: step.body.trim() }))
      .filter((step) => step.body.length > 0);
    if (steps.length === 0) {
      this.error.set('Cần ít nhất một bước hướng dẫn.');
      return;
    }
    const ingredients = this.ingredients();
    if (ingredients.some((row) => !row.foodId || row.quantity < 0)) {
      this.error.set('Mỗi nguyên liệu cần một món và số lượng ≥ 0.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      let imageUrl = this.coverUrl() ?? undefined;
      if (this.coverFile) {
        const uploaded = await firstValueFrom(
          this.api.uploadImage(this.coverFile, 'recipes'),
        );
        imageUrl = uploaded.url;
        this.coverUrl.set(uploaded.url);
        this.coverFile = null;
      }

      const stepPayload = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        let stepImage = step.imageUrl ?? undefined;
        if (step.file) {
          const uploaded = await firstValueFrom(
            this.api.uploadImage(step.file, 'recipes'),
          );
          stepImage = uploaded.url;
        }
        stepPayload.push({
          body: step.body,
          sortOrder: i,
          ...(stepImage ? { imageUrl: stepImage } : {}),
        });
      }

      const value = this.form.getRawValue();
      const prep = value.prepTimeMin.trim();
      const cook = value.cookTimeMin.trim();
      const body = {
        title: value.title.trim(),
        description: value.description.trim() || undefined,
        servings: Number(value.servings),
        difficulty: value.difficulty,
        visibility: value.visibility,
        ...(prep !== '' ? { prepTimeMin: Number(prep) } : {}),
        ...(cook !== '' ? { cookTimeMin: Number(cook) } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        steps: stepPayload,
        ingredients: ingredients.map((row, index) => ({
          foodId: row.foodId,
          quantity: Number(row.quantity),
          unit: row.unit,
          optional: row.optional,
          sortOrder: index,
          ...(row.note.trim() ? { note: row.note.trim() } : {}),
        })),
      };

      const id = this.recipeId();
      const saved = await firstValueFrom(
        id ? this.api.updateRecipe(id, body) : this.api.createRecipe(body),
      );
      this.saving.set(false);
      await this.router.navigate(['/recipes', saved.slug]);
    } catch (err) {
      this.saving.set(false);
      const apiErr = err as { error?: { message?: string | string[] }; message?: string };
      const message = apiErr.error?.message ?? apiErr.message ?? 'Không lưu được recipe';
      this.error.set(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  private blankIngredient(): DraftIngredient {
    return {
      key: this.nextKey++,
      foodId: '',
      foodName: '',
      quantity: 1,
      unit: 'g',
      optional: false,
      note: '',
    };
  }

  private blankStep(): DraftStep {
    return {
      key: this.nextKey++,
      body: '',
      imageUrl: null,
      previewUrl: null,
      file: null,
    };
  }

  private asDifficulty(value: string): 'EASY' | 'MEDIUM' | 'HARD' {
    if (value === 'MEDIUM' || value === 'HARD') return value;
    return 'EASY';
  }

  private asVisibility(value: string): 'PUBLIC' | 'PRIVATE' | 'UNLISTED' {
    if (value === 'PRIVATE' || value === 'UNLISTED') return value;
    return 'PUBLIC';
  }
}
