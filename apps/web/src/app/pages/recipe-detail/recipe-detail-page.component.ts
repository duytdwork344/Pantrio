import {
  Component,
  ElementRef,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type {
  NutrientAmount,
  RecipeDetail,
  RecipeNutrition,
} from '../../core/models';

const PROFILE_CODES = new Set([
  'energy_kcal',
  'protein',
  'carb',
  'fat',
  'fiber',
  'sugar',
]);

@Component({
  selector: 'app-recipe-detail-page',
  imports: [RouterLink],
  templateUrl: './recipe-detail-page.component.html',
  styleUrl: './recipe-detail-page.component.scss',
})
export class RecipeDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly recipe = signal<RecipeDetail | null>(null);
  readonly sharing = signal(false);
  readonly shareHint = signal<string | null>(null);
  readonly openNutrient = signal<string | null>(null);
  readonly pipActive = signal(false);
  readonly pipDismissed = signal(false);
  readonly pipDragging = signal(false);
  readonly pipLeft = signal(0);
  readonly pipTop = signal(0);

  private readonly heroSlot = viewChild<ElementRef<HTMLElement>>('heroSlot');
  private readonly heroVideo =
    viewChild<ElementRef<HTMLVideoElement>>('heroVideo');
  private readonly pipVideo =
    viewChild<ElementRef<HTMLVideoElement>>('pipVideo');
  private observer: IntersectionObserver | null = null;
  private pipDragOffsetX = 0;
  private pipDragOffsetY = 0;
  private pipHasCustomPosition = false;
  private readonly onPipPointerMove = (event: PointerEvent) =>
    this.movePip(event);
  private readonly onPipPointerUp = () => this.endPipDrag();

  profileNutrients(rows: NutrientAmount[]): NutrientAmount[] {
    return rows.filter((row) => PROFILE_CODES.has(row.code));
  }

  formatNutrient(amount: number): string {
    if (amount >= 100) return String(Math.round(amount));
    if (amount >= 10) return amount.toFixed(1);
    return amount.toFixed(2).replace(/\.?0+$/, '');
  }

  targetPercent(n: RecipeNutrition, code: string): number | null {
    const pct = n.targetComparison?.perServingPercent?.[code];
    return pct == null ? null : pct;
  }

  toggleNutrient(code: string): void {
    this.openNutrient.update((cur) => (cur === code ? null : code));
  }

  showNutrient(code: string): void {
    this.openNutrient.set(code);
  }

  hideNutrient(): void {
    this.openNutrient.set(null);
  }

  isNutrientOpen(code: string): boolean {
    return this.openNutrient() === code;
  }

  dismissPip(): void {
    this.endPipDrag();
    this.pipDismissed.set(true);
    this.pipActive.set(false);
    const hero = this.heroVideo()?.nativeElement;
    if (hero && hero.paused) {
      void hero.play().catch(() => undefined);
    }
  }

  onPipPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.pipDragging.set(true);
    this.pipDragOffsetX = event.clientX - this.pipLeft();
    this.pipDragOffsetY = event.clientY - this.pipTop();
    window.addEventListener('pointermove', this.onPipPointerMove);
    window.addEventListener('pointerup', this.onPipPointerUp);
    window.addEventListener('pointercancel', this.onPipPointerUp);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.teardownObserver();
      this.endPipDrag();
    });

    this.route.paramMap
      .pipe(
        tap(() => {
          this.teardownObserver();
          this.endPipDrag();
          this.pipActive.set(false);
          this.pipDismissed.set(false);
          this.pipHasCustomPosition = false;
        }),
        switchMap((params) => {
          const slug = params.get('slug') ?? '';
          this.loading.set(true);
          this.error.set(null);
          this.shareHint.set(null);
          this.openNutrient.set(null);
          return this.api.getRecipeBySlug(slug);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (recipe) => {
          this.recipe.set(recipe);
          this.loading.set(false);
          requestAnimationFrame(() => {
            this.setupPipObserver();
            this.tryAutoplayHero();
          });
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

  private tryAutoplayHero(): void {
    const video = this.heroVideo()?.nativeElement;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => undefined);
  }

  private setupPipObserver(): void {
    this.teardownObserver();
    const slot = this.heroSlot()?.nativeElement;
    if (!slot || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || this.pipDismissed()) return;
        const shouldPip = !entry.isIntersecting;
        if (shouldPip === this.pipActive()) return;
        this.pipActive.set(shouldPip);
        if (shouldPip) {
          if (!this.pipHasCustomPosition) this.placePipDefault();
          requestAnimationFrame(() => this.syncPipFromHero());
        }
      },
      { threshold: 0.15 },
    );
    this.observer.observe(slot);
  }

  private placePipDefault(): void {
    if (typeof window === 'undefined') return;
    const width = Math.min(window.innerWidth * 0.42, 256);
    const height = width * (9 / 16) + 36;
    const margin = 16;
    this.pipLeft.set(Math.max(margin, window.innerWidth - width - margin));
    this.pipTop.set(Math.max(margin, window.innerHeight - height - margin));
  }

  private movePip(event: PointerEvent): void {
    if (!this.pipDragging()) return;
    const width = Math.min(window.innerWidth * 0.42, 256);
    const height = width * (9 / 16) + 36;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    this.pipLeft.set(
      Math.min(maxLeft, Math.max(margin, event.clientX - this.pipDragOffsetX)),
    );
    this.pipTop.set(
      Math.min(maxTop, Math.max(margin, event.clientY - this.pipDragOffsetY)),
    );
    this.pipHasCustomPosition = true;
  }

  private endPipDrag(): void {
    if (!this.pipDragging()) {
      window.removeEventListener('pointermove', this.onPipPointerMove);
      window.removeEventListener('pointerup', this.onPipPointerUp);
      window.removeEventListener('pointercancel', this.onPipPointerUp);
      return;
    }
    this.pipDragging.set(false);
    window.removeEventListener('pointermove', this.onPipPointerMove);
    window.removeEventListener('pointerup', this.onPipPointerUp);
    window.removeEventListener('pointercancel', this.onPipPointerUp);
  }

  private syncPipFromHero(): void {
    const hero = this.heroVideo()?.nativeElement;
    const pip = this.pipVideo()?.nativeElement;
    if (!hero || !pip) return;
    const wasPlaying = !hero.paused;
    try {
      pip.currentTime = hero.currentTime;
    } catch {
      // ignore seek before metadata
    }
    if (wasPlaying) {
      void pip.play().catch(() => undefined);
    }
  }

  private teardownObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  async share(): Promise<void> {
    const r = this.recipe();
    if (!r || this.sharing()) {
      return;
    }
    this.sharing.set(true);
    this.shareHint.set(null);

    const url = typeof window !== 'undefined' ? window.location.href : '';
    let channel: 'copy' | 'native' | 'unknown' = 'unknown';
    let copied = false;

    try {
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      if (nav && typeof nav.share === 'function') {
        try {
          await nav.share({
            title: r.title,
            text: r.description ?? r.title,
            url,
          });
          channel = 'native';
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            this.sharing.set(false);
            return;
          }
          copied = await this.tryCopyLink(url);
          channel = copied ? 'copy' : 'unknown';
        }
      } else {
        copied = await this.tryCopyLink(url);
        channel = copied ? 'copy' : 'unknown';
      }

      this.api.shareRecipe(r.id, channel).subscribe({
        next: (res) => {
          this.recipe.update((cur) =>
            cur ? { ...cur, shareCount: res.shareCount } : cur,
          );
          this.sharing.set(false);
          if (res.rateLimited) {
            this.shareHint.set('Vừa share gần đây — count chưa tăng thêm.');
          } else if (channel === 'native') {
            this.shareHint.set('Đã ghi nhận share.');
          } else if (copied) {
            this.shareHint.set('Đã copy link và ghi nhận share.');
          } else {
            this.shareHint.set(
              `Đã ghi nhận share. Copy thủ công: ${url}`,
            );
          }
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.sharing.set(false);
          this.shareHint.set(
            err.error?.message ?? err.message ?? 'Share thất bại',
          );
        },
      });
    } catch (err) {
      this.sharing.set(false);
      this.shareHint.set(
        err instanceof Error ? err.message : 'Share thất bại',
      );
    }
  }

  /**
   * Clipboard API needs a secure context (HTTPS or localhost).
   * LAN http://192.168.x.x often blocks it — fall back to execCommand.
   */
  private async tryCopyLink(url: string): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch {
      // fall through
    }

    try {
      if (typeof document === 'undefined') {
        return false;
      }
      const input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, url.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    } catch {
      return false;
    }
  }
}
