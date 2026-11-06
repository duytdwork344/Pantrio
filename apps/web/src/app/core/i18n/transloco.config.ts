import { HttpClient } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@pantrio/shared';

/** UI strings live in `public/i18n/<locale>.json` (requirements 2b.1 #5). */
@Injectable({ providedIn: 'root' })
export class HttpTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
  }
}

export function provideI18n() {
  return provideTransloco({
    config: {
      availableLangs: [...SUPPORTED_LOCALES],
      defaultLang: DEFAULT_LOCALE,
      // A key missing in `en` shows the `vi` string instead of the raw key.
      fallbackLang: DEFAULT_LOCALE,
      missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
    },
    loader: HttpTranslocoLoader,
  });
}
