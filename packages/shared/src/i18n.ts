/**
 * Locale registry (requirements 2b.1).
 *
 * Adding a language = add an entry to LOCALES (+ UI string files on clients).
 * Codes are BCP-47 and stored as plain strings in the database.
 */

export type LocaleInfo = {
  /** BCP-47 code, e.g. `vi`, `en`, `zh-Hans`. */
  code: string;
  /** Name in the language itself (for language pickers). */
  nativeName: string;
  /** Tried in order after the locale itself, before DEFAULT_LOCALE. */
  fallback: readonly string[];
  dir: 'ltr' | 'rtl';
};

export const LOCALES = {
  vi: { code: 'vi', nativeName: 'Tiếng Việt', fallback: [], dir: 'ltr' },
  en: { code: 'en', nativeName: 'English', fallback: [], dir: 'ltr' },
} as const satisfies Record<string, LocaleInfo>;

export type SupportedLocale = keyof typeof LOCALES;

/** Default locale for UI and content when nothing else matches. */
export const DEFAULT_LOCALE: SupportedLocale = 'vi';

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as SupportedLocale[];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && value in LOCALES;
}

/**
 * Map any tag to a supported locale: exact match, then base language
 * (`en-US` → `en`). Returns null when nothing matches.
 */
export function matchLocale(tag?: string | null): SupportedLocale | null {
  if (!tag) return null;
  const value = tag.trim().toLowerCase();
  if (!value) return null;
  const exact = SUPPORTED_LOCALES.find((code) => code.toLowerCase() === value);
  if (exact) return exact;
  const base = value.split(/[-_]/)[0];
  return SUPPORTED_LOCALES.find((code) => code.toLowerCase() === base) ?? null;
}

/** Pick the best supported locale from an `Accept-Language` header. */
export function negotiateLocale(
  acceptLanguage?: string | null,
): SupportedLocale | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((item) => item.tag && item.tag !== '*' && item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const item of ranked) {
    const match = matchLocale(item.tag);
    if (match) return match;
  }
  return null;
}

/**
 * Order to try translations in: the locale, its fallbacks, then DEFAULT_LOCALE.
 * Content may still fall back to its own `sourceLocale` after this chain.
 */
export function localeChain(locale?: string | null): SupportedLocale[] {
  const start = matchLocale(locale) ?? DEFAULT_LOCALE;
  const chain: SupportedLocale[] = [];
  const push = (code: string) => {
    const match = matchLocale(code);
    if (match && !chain.includes(match)) chain.push(match);
  };
  push(start);
  for (const code of LOCALES[start].fallback) push(code);
  push(DEFAULT_LOCALE);
  return chain;
}
