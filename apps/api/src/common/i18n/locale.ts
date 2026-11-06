import {
  localeChain,
  matchLocale,
  type SupportedLocale,
} from '@pantrio/shared';
import { currentLocale } from './request-locale';

/**
 * A supported locale for `locale`, or the current request locale when it is
 * missing or not supported (requirements 2b.1 #3).
 */
export function normalizeLocale(locale?: string | null): SupportedLocale {
  return matchLocale(locale) ?? currentLocale();
}

/**
 * Best translation for `locale` (default: the request locale): the locale,
 * its fallback chain, DEFAULT_LOCALE, then any available translation.
 */
export function pickTranslation<T extends { locale: string }>(
  translations: T[],
  locale?: string | null,
): T | null {
  if (!translations.length) {
    return null;
  }
  for (const code of localeChain(normalizeLocale(locale))) {
    const match = translations.find((item) => item.locale === code);
    if (match) return match;
  }
  return translations[0] ?? null;
}
