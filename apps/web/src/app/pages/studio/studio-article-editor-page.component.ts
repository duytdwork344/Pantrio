import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { RecipeSummary } from '../../core/models';

@Component({
  selector: 'app-studio-article-editor-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './studio-article-editor-page.component.html',
  styleUrl: './studio-article-editor-page.component.scss',
})
export class StudioArticleEditorPageComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly articleId = signal<string | null>(null);
  readonly recipes = signal<RecipeSummary[]>([]);
  readonly selectedRecipeIds = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    summary: [''],
    body: ['', [Validators.required, Validators.minLength(1)]],
    publish: [false],
  });

  constructor() {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/login');
      return;
    }
    if (!this.auth.canCreateArticle()) {
      this.error.set('Tài khoản chưa có quyền article:create (cần CREATOR).');
      this.loading.set(false);
      return;
    }

    this.api.listRecipes().subscribe({
      next: (rows) => this.recipes.set(rows),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.articleId.set(null);
      this.loading.set(false);
      return;
    }

    this.articleId.set(id);
    this.api.getMyArticle(id).subscribe({
      next: (article) => {
        this.form.setValue({
          title: article.title,
          summary: article.summary ?? '',
          body: article.body,
          publish: Boolean(article.publishedAt),
        });
        this.selectedRecipeIds.set(article.recipes.map((r) => r.id));
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message ?? err.message ?? 'Không tải được draft',
        );
      },
    });
  }

  toggleRecipe(id: string): void {
    const current = this.selectedRecipeIds();
    if (current.includes(id)) {
      this.selectedRecipeIds.set(current.filter((x) => x !== id));
    } else {
      this.selectedRecipeIds.set([...current, id]);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedRecipeIds().includes(id);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    const body = {
      title: value.title,
      summary: value.summary.trim() || undefined,
      body: value.body,
      publish: value.publish,
      recipeIds: this.selectedRecipeIds(),
    };
    const id = this.articleId();
    const req = id
      ? this.api.updateArticle(id, body)
      : this.api.createArticle(body);

    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.articleId.set(saved.id);
        if (saved.publishedAt) {
          void this.router.navigate(['/articles', saved.slug]);
        } else {
          void this.router.navigate(['/studio/articles', saved.id]);
        }
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        const msg = err.error?.message;
        this.error.set(
          Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Lưu thất bại'),
        );
      },
    });
  }
}
