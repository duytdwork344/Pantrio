import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@pantrio/shared';

type TranslationLike = {
  locale: string;
  name: string;
  category?: string | null;
};

export function normalizeLocale(locale?: string): string {
  const value = (locale ?? DEFAULT_LOCALE).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? value
    : DEFAULT_LOCALE;
}

/** Prefer requested locale, then DEFAULT_LOCALE, then any available translation. */
export function pickTranslation<T extends TranslationLike>(
  translations: T[],
  locale?: string,
): T | null {
  if (!translations.length) {
    return null;
  }

  const preferred = normalizeLocale(locale);
  return (
    translations.find((item) => item.locale === preferred) ??
    translations.find((item) => item.locale === DEFAULT_LOCALE) ??
    translations[0] ??
    null
  );
}
