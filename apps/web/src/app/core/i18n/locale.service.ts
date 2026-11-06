import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  DEFAULT_LOCALE,
  LOCALES,
  SUPPORTED_LOCALES,
  matchLocale,
  negotiateLocale,
  type SupportedLocale,
} from '@pantrio/shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import type { UserProfile } from '../models';

const STORAGE_KEY = 'pantrio.locale';

/**
 * Active UI + content locale (requirements 2b.1 #3–4).
 *
 * Start: saved choice → User.locale → browser languages → DEFAULT_LOCALE.
 * Signed in, User.locale wins and a change is saved with PATCH /users/me.
 * Every API call sends it as Accept-Language (see localeInterceptor).
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  readonly options = SUPPORTED_LOCALES.map((code) => LOCALES[code]);
  private readonly localeSignal = signal<SupportedLocale>(this.initialLocale());
  readonly locale = this.localeSignal.asReadonly();

  constructor() {
    this.apply(this.localeSignal());
    // Signing in with a saved User.locale switches the app to it.
    effect(() => {
      const fromUser = matchLocale(this.auth.user()?.locale);
      if (fromUser && fromUser !== untracked(this.localeSignal)) {
        this.apply(fromUser);
      }
    });
  }

  /** Switch language; saved on this device and, when signed in, on the account. */
  setLocale(locale: SupportedLocale): void {
    this.apply(locale);
    if (!this.auth.isAuthenticated()) return;
    this.http
      .patch<UserProfile>(`${environment.apiBaseUrl}/users/me`, { locale })
      .subscribe({ next: (user) => this.auth.updateUser(user) });
  }

  private apply(locale: SupportedLocale): void {
    this.localeSignal.set(locale);
    this.transloco.setActiveLang(locale);
    this.document.documentElement.lang = locale;
    this.document.documentElement.dir = LOCALES[locale].dir;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Storage blocked (private mode): the choice lasts for this tab only.
    }
  }

  private initialLocale(): SupportedLocale {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    const browser = negotiateLocale(
      (this.document.defaultView?.navigator.languages ?? []).join(','),
    );
    return (
      matchLocale(saved) ??
      matchLocale(this.auth.user()?.locale) ??
      browser ??
      DEFAULT_LOCALE
    );
  }
}
