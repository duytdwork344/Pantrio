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
  readonly sharing = signal(false);
  readonly shareHint = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const slug = params.get('slug') ?? '';
          this.loading.set(true);
          this.error.set(null);
          this.shareHint.set(null);
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
