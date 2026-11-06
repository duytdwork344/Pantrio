import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from './locale.service';

/**
 * Locale-aware formatting with Intl (requirements 2b.1 #7). Impure so the text
 * updates when the language changes; formatters are cached per locale.
 *
 *   {{ item.expiryDate | fmtDate }}          → 12/11/2026 · 11/12/2026
 *   {{ amount | fmtNumber: { maximumFractionDigits: 1 } }}
 */
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function cached<T>(map: Map<string, T>, key: string, make: () => T): T {
  let value = map.get(key);
  if (!value) {
    value = make();
    map.set(key, value);
  }
  return value;
}

export function formatDate(
  locale: string,
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const fmt = cached(dateFormats, `${locale}|${JSON.stringify(options)}`, () =>
    new Intl.DateTimeFormat(locale, options),
  );
  return fmt.format(date);
}

export function formatNumber(
  locale: string,
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 },
): string {
  if (value == null || Number.isNaN(value)) return '';
  const fmt = cached(numberFormats, `${locale}|${JSON.stringify(options)}`, () =>
    new Intl.NumberFormat(locale, options),
  );
  return fmt.format(value);
}

@Pipe({ name: 'fmtDate', pure: false })
export class FmtDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService).locale;

  transform(
    value: string | number | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    return formatDate(this.locale(), value, options);
  }
}

@Pipe({ name: 'fmtNumber', pure: false })
export class FmtNumberPipe implements PipeTransform {
  private readonly locale = inject(LocaleService).locale;

  transform(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    return formatNumber(this.locale(), value, options);
  }
}
