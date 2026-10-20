import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { NutritionPreset, NutritionTarget } from '../../core/models';

function apiMessage(err: {
  error?: { message?: string | string[] };
  message?: string;
}): string {
  const message = err.error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? err.message ?? 'Có lỗi xảy ra';
}

@Component({
  selector: 'app-nutrition-target-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './nutrition-target-page.component.html',
  styleUrl: './nutrition-target-page.component.scss',
})
export class NutritionTargetPageComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly target = signal<NutritionTarget | null>(null);
  readonly presets = signal<NutritionPreset[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  sex: 'MALE' | 'FEMALE' = 'FEMALE';
  ageYears = 30;
  weightKg = 55;
  heightCm = 160;
  activity = 'MODERATE';
  presetCode = 'ADULT_DEFAULT';

  energyKcal = 2000;
  proteinG = 100;
  fatG = 67;
  carbG = 250;

  readonly activities = [
    { value: 'SEDENTARY', label: 'Ít vận động' },
    { value: 'LIGHT', label: 'Nhẹ' },
    { value: 'MODERATE', label: 'Vừa' },
    { value: 'ACTIVE', label: 'Nhiều' },
    { value: 'VERY_ACTIVE', label: 'Rất nhiều' },
  ];

  constructor() {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/login');
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listNutritionPresets().subscribe({
      next: (rows) => this.presets.set(rows),
      error: () => this.presets.set([]),
    });
    this.api.getNutritionTarget().subscribe({
      next: (row) => {
        this.target.set(row);
        if (row) this.applyForm(row);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.loading.set(false);
        this.error.set(apiMessage(err));
      },
    });
  }

  compute(): void {
    this.saving.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.api
      .computeNutritionTarget({
        sex: this.sex,
        ageYears: Number(this.ageYears),
        weightKg: Number(this.weightKg),
        heightCm: Number(this.heightCm),
        activity: this.activity,
      })
      .subscribe({
        next: (row) => {
          this.target.set(row);
          this.applyForm(row);
          this.saving.set(false);
          this.ok.set('Đã tính và lưu target ngày (Mifflin).');
        },
        error: (err: { error?: { message?: string | string[] }; message?: string }) => {
          this.saving.set(false);
          this.error.set(apiMessage(err));
        },
      });
  }

  applyPreset(): void {
    this.saving.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.api.applyNutritionPreset(this.presetCode).subscribe({
      next: (row) => {
        this.target.set(row);
        this.applyForm(row);
        this.saving.set(false);
        this.ok.set('Đã áp dụng preset.');
      },
      error: (err: { error?: { message?: string | string[] }; message?: string }) => {
        this.saving.set(false);
        this.error.set(apiMessage(err));
      },
    });
  }

  saveManual(): void {
    this.saving.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.api
      .saveManualNutritionTarget({
        energyKcal: Number(this.energyKcal),
        proteinG: Number(this.proteinG),
        fatG: Number(this.fatG),
        carbG: Number(this.carbG),
      })
      .subscribe({
        next: (row) => {
          this.target.set(row);
          this.applyForm(row);
          this.saving.set(false);
          this.ok.set('Đã lưu target chỉnh tay.');
        },
        error: (err: { error?: { message?: string | string[] }; message?: string }) => {
          this.saving.set(false);
          this.error.set(apiMessage(err));
        },
      });
  }

  private applyForm(row: NutritionTarget): void {
    if (row.sex) this.sex = row.sex;
    if (row.ageYears != null) this.ageYears = row.ageYears;
    if (row.weightKg != null) this.weightKg = row.weightKg;
    if (row.heightCm != null) this.heightCm = row.heightCm;
    this.activity = row.activity;
    if (row.presetCode) this.presetCode = row.presetCode;
    this.energyKcal = row.energyKcal;
    this.proteinG = row.proteinG;
    this.fatG = row.fatG;
    this.carbG = row.carbG;
  }
}
