import { localeChain, negotiateLocale } from '@pantrio/shared';
import { normalizeLocale, pickTranslation } from './locale';
import { currentLocale, runWithLocale } from './request-locale';

const translations = [
  { locale: 'vi', name: 'Cà chua' },
  { locale: 'en', name: 'Tomato' },
];

describe('negotiateLocale', () => {
  it('picks the highest-weighted supported tag', () => {
    expect(negotiateLocale('fr-FR,fr;q=0.9,en;q=0.8,vi;q=0.7')).toBe('en');
    expect(negotiateLocale('vi-VN,vi;q=0.9,en;q=0.5')).toBe('vi');
    expect(negotiateLocale('en;q=0.2,vi;q=0.8')).toBe('vi');
  });

  it('returns null when nothing is supported', () => {
    expect(negotiateLocale('fr,de;q=0.5')).toBeNull();
    expect(negotiateLocale('*')).toBeNull();
    expect(negotiateLocale(undefined)).toBeNull();
  });
});

describe('localeChain', () => {
  it('ends with the default locale', () => {
    expect(localeChain('en')).toEqual(['en', 'vi']);
    expect(localeChain('vi')).toEqual(['vi']);
    expect(localeChain('fr')).toEqual(['vi']);
  });
});

describe('pickTranslation', () => {
  it('uses the request locale when none is passed', () => {
    expect(runWithLocale('en', () => pickTranslation(translations)?.name)).toBe(
      'Tomato',
    );
    expect(runWithLocale('vi', () => pickTranslation(translations)?.name)).toBe(
      'Cà chua',
    );
  });

  it('falls back along the chain, then to any translation', () => {
    expect(
      pickTranslation([{ locale: 'vi', name: 'Cà chua' }], 'en')?.name,
    ).toBe('Cà chua');
    expect(
      pickTranslation([{ locale: 'ja', name: 'トマト' }], 'en')?.name,
    ).toBe('トマト');
    expect(pickTranslation([], 'en')).toBeNull();
  });

  it('defaults to vi outside a request', () => {
    expect(currentLocale()).toBe('vi');
    expect(normalizeLocale(undefined)).toBe('vi');
    expect(normalizeLocale('EN-us')).toBe('en');
  });
});
