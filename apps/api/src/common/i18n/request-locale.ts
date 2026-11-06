import { AsyncLocalStorage } from 'node:async_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
} from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  matchLocale,
  negotiateLocale,
  type SupportedLocale,
} from '@pantrio/shared';
import type { NextFunction, Request, Response } from 'express';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../decorators/current-user.decorator';

/** Where the request locale came from, strongest first (requirements 2b.1 #3). */
export type LocaleSource = 'query' | 'header' | 'user' | 'default';

type LocaleStore = { locale: SupportedLocale; source: LocaleSource };

const storage = new AsyncLocalStorage<LocaleStore>();

/**
 * Locale of the current request. Services call this (or `pickTranslation`
 * without a locale) instead of threading `locale` through every method.
 * Outside a request (seed, scripts, boot reindex) it is DEFAULT_LOCALE.
 */
export function currentLocale(): SupportedLocale {
  return storage.getStore()?.locale ?? DEFAULT_LOCALE;
}

/** Run `fn` with a fixed locale, e.g. in tests or background jobs. */
export function runWithLocale<T>(locale: SupportedLocale, fn: () => T): T {
  return storage.run({ locale, source: 'query' }, fn);
}

function queryLocale(req: Request): SupportedLocale | null {
  const raw = req.query?.locale;
  return matchLocale(typeof raw === 'string' ? raw : null);
}

/**
 * Resolves `?locale=` (kept for old clients) and `Accept-Language` before
 * guards run. `User.locale` is applied later by LocaleInterceptor, because the
 * user is only known after the JWT guard.
 */
@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const fromQuery = queryLocale(req);
    const fromHeader = fromQuery
      ? null
      : negotiateLocale(req.headers['accept-language']);
    const store: LocaleStore = fromQuery
      ? { locale: fromQuery, source: 'query' }
      : fromHeader
        ? { locale: fromHeader, source: 'header' }
        : { locale: DEFAULT_LOCALE, source: 'default' };
    storage.run(store, () => next());
  }
}

/** Applies `User.locale` when the request named no locale, and echoes it back. */
@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const http = context.switchToHttp();
      const req = http.getRequest<Request & { user?: AuthUser }>();
      const store = storage.getStore();
      if (store && store.source === 'default') {
        const fromUser = matchLocale(req.user?.locale);
        if (fromUser) {
          store.locale = fromUser;
          store.source = 'user';
        }
      }
      http
        .getResponse<Response>()
        .setHeader('Content-Language', currentLocale());
    }
    return next.handle();
  }
}
