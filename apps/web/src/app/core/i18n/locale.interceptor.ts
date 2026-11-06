import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LocaleService } from './locale.service';

/** Sends the active locale to the API (requirements 2b.1 #3). */
export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }
  const locale = inject(LocaleService).locale();
  return next(req.clone({ setHeaders: { 'Accept-Language': locale } }));
};
