import type { TranslocoService } from '@jsverse/transloco';
import type { ApiErrorBody } from '@pantrio/shared';

type HttpErrorLike = { error?: Partial<ApiErrorBody> | null; message?: string };

/**
 * User-facing text for an API error (requirements 2b.1 #8):
 * `errors.<code>` when translated, else the server message, else `fallbackKey`.
 */
export function apiErrorMessage(
  err: HttpErrorLike,
  t: TranslocoService,
  fallbackKey = 'errors.UNKNOWN',
): string {
  const body = err.error ?? undefined;
  if (body?.code) {
    const key = `errors.${body.code}`;
    const text = t.translate(key, body.params ?? {});
    if (text && text !== key) return text;
  }
  return body?.message || t.translate(fallbackKey);
}
