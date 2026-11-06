import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { localeInterceptor } from './core/i18n/locale.interceptor';
import { LocaleService } from './core/i18n/locale.service';
import { provideI18n } from './core/i18n/transloco.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, localeInterceptor])),
    provideI18n(),
    // Pick the locale and load its strings before the first render.
    provideAppInitializer(() => {
      const locale = inject(LocaleService).locale();
      return firstValueFrom(inject(TranslocoService).load(locale));
    }),
  ],
};
