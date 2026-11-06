import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from './locale.service';

/**
 * "No English version yet · showing the original (Vietnamese)" when content is
 * shown in another language than the reader's (requirements 2b.2 #6).
 */
@Component({
  selector: 'app-fallback-notice',
  imports: [TranslocoPipe],
  template: `
    @if (visible()) {
      <p class="fallback-notice" role="note">
        {{
          'content.fallbackNotice'
            | transloco
              : {
                  missing: 'language.names.' + i18n.locale() | transloco,
                  shown: 'language.names.' + displayLocale() | transloco,
                }
        }}
      </p>
    }
  `,
  styles: `
    .fallback-notice {
      display: inline-block;
      margin: 0 0 0.75rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: var(--color-bg-2);
      color: var(--color-muted);
      font-size: 0.85rem;
    }
  `,
})
export class FallbackNoticeComponent {
  readonly i18n = inject(LocaleService);
  readonly displayLocale = input<string | undefined>();

  readonly visible = computed(() => {
    const shown = this.displayLocale();
    return Boolean(shown) && shown !== this.i18n.locale();
  });
}
