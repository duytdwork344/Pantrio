import { TranslationOrigin } from '@prisma/client';
import { runWithLocale } from '../common/i18n/request-locale';
import {
  availableLocales,
  localizedHeader,
  mergeTexts,
  remapNotes,
  resolveText,
  textsFromRevision,
  textsFromRows,
  type RecipeText,
} from './recipe-content';

const vi: RecipeText = {
  locale: 'vi',
  title: 'Canh chua cá lóc',
  description: 'Chua thanh',
  steps: ['Sơ chế cá', 'Nấu nước me'],
  notes: { fish: 'cá tươi' },
  origin: TranslationOrigin.AUTHOR,
  translatedById: 'author',
};
const en: RecipeText = {
  ...vi,
  locale: 'en',
  title: 'Sour fish soup',
  description: 'Tangy',
  steps: ['Prep the fish', 'Make tamarind broth'],
  notes: { fish: 'fresh fish' },
};

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('resolveText / availableLocales', () => {
  it('shows the reader locale when complete', () => {
    expect(resolveText([vi, en], 'vi', 'en', 2).displayLocale).toBe('en');
    expect(resolveText([vi, en], 'vi', 'vi', 2).displayLocale).toBe('vi');
  });

  it('falls back to the source when the reader locale is incomplete', () => {
    const partial = { ...en, steps: ['Prep the fish', ''] };
    const result = resolveText([vi, partial], 'vi', 'en', 2);
    expect(result.displayLocale).toBe('vi');
    expect(availableLocales([vi, partial], 'vi', 2)).toEqual(['vi']);
  });

  it('lists the source first', () => {
    expect(availableLocales([en, vi], 'vi', 2)).toEqual(['vi', 'en']);
  });
});

describe('mergeTexts', () => {
  const base = [vi, en];
  const source = {
    title: vi.title,
    description: vi.description,
    steps: vi.steps,
    notes: vi.notes,
  };
  const common = {
    sourceLocale: 'vi',
    stepCount: 2,
    foodIds: new Set(['fish']),
    actorId: 'author',
  };

  it('keeps other locales when translations are omitted, re-aligned to the steps', () => {
    const texts = mergeTexts({
      ...common,
      base,
      source: { ...source, steps: [...vi.steps, 'Nêm nếm'] },
      stepCount: 3,
    });
    expect(texts.map((t) => t.locale)).toEqual(['vi', 'en']);
    expect(texts[1].steps).toEqual([...en.steps, '']);
    expect(availableLocales(texts, 'vi', 3)).toEqual(['vi']);
  });

  it('replaces non-source locales when translations are sent', () => {
    expect(
      mergeTexts({ ...common, base, source, translations: [] }).map(
        (t) => t.locale,
      ),
    ).toEqual(['vi']);
  });

  it('keeps origin of an unchanged moderator translation', () => {
    const byModerator = {
      ...en,
      origin: TranslationOrigin.MODERATOR,
      translatedById: 'mod',
    };
    const texts = mergeTexts({
      ...common,
      base: [vi, byModerator],
      source,
      translations: [
        {
          locale: 'en',
          title: en.title,
          description: en.description,
          steps: en.steps,
          notes: [{ foodId: 'fish', note: 'fresh fish' }],
        },
      ],
    });
    expect(texts[1].origin).toBe(TranslationOrigin.MODERATOR);
    expect(texts[1].translatedById).toBe('mod');
  });

  it('rejects half-filled tabs and translations of the source locale', () => {
    expect(
      code(() =>
        mergeTexts({
          ...common,
          base,
          source,
          translations: [{ locale: 'en', title: 'X', steps: ['only one'] }],
        }),
      ),
    ).toBe('TRANSLATION_INCOMPLETE');
    expect(
      code(() =>
        mergeTexts({
          ...common,
          base,
          source,
          translations: [{ locale: 'vi', title: 'X', steps: ['a', 'b'] }],
        }),
      ),
    ).toBe('TRANSLATION_IS_SOURCE');
    expect(
      code(() =>
        mergeTexts({
          ...common,
          base,
          source,
          translations: [{ locale: 'fr', title: 'X', steps: ['a', 'b'] }],
        }),
      ),
    ).toBe('LOCALE_NOT_SUPPORTED');
  });

  it('drops notes for foods that are not in the recipe', () => {
    const texts = mergeTexts({
      ...common,
      base,
      source,
      translations: [
        {
          locale: 'en',
          title: 'X',
          steps: ['a', 'b'],
          notes: [{ foodId: 'ghost', note: 'n' }],
        },
      ],
    });
    expect(texts[1].notes).toEqual({});
  });
});

describe('textsFromRows / textsFromRevision', () => {
  it('uses legacy columns when a recipe has no translation rows', () => {
    const texts = textsFromRows({
      sourceLocale: 'en',
      authorId: 'a',
      title: 'Carbonara',
      description: null,
      translations: [],
      steps: [{ body: 'Boil pasta' }],
      ingredients: [{ foodId: 'egg', note: '2 yolks' }],
    });
    expect(texts).toEqual([
      expect.objectContaining({
        locale: 'en',
        title: 'Carbonara',
        steps: ['Boil pasta'],
        notes: { egg: '2 yolks' },
      }),
    ]);
  });

  it('derives texts for revisions saved before translationsJson', () => {
    const texts = textsFromRevision(
      {
        sourceLocale: 'vi',
        title: 'Phở',
        description: null,
        translationsJson: null,
      },
      [{ body: 'Ninh xương' }],
      [],
      'a',
    );
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatchObject({
      locale: 'vi',
      title: 'Phở',
      steps: ['Ninh xương'],
    });
  });
});

describe('remapNotes', () => {
  it('follows merged foods and keeps the first note on collision', () => {
    const texts = remapNotes(
      [{ ...vi, notes: { a: 'first', b: 'second' } }],
      (id) => (id === 'b' ? 'a' : id),
    );
    expect(texts[0].notes).toEqual({ a: 'first' });
  });
});

describe('localizedHeader', () => {
  const recipe = {
    sourceLocale: 'vi',
    title: 'Canh chua',
    description: null,
    translations: [
      { locale: 'vi', title: 'Canh chua', description: null },
      { locale: 'en', title: 'Sour soup', description: null },
    ],
    steps: [
      { translations: [{ locale: 'vi' }, { locale: 'en' }] },
      { translations: [{ locale: 'vi' }] },
    ],
  };

  it('only offers a locale whose steps are all translated', () => {
    const header = runWithLocale('en', () => localizedHeader(recipe, 'en'));
    expect(header.title).toBe('Canh chua');
    expect(header.availableLocales).toEqual(['vi']);

    const full = {
      ...recipe,
      steps: recipe.steps.map(() => ({
        translations: [{ locale: 'vi' }, { locale: 'en' }],
      })),
    };
    expect(localizedHeader(full, 'en')).toMatchObject({
      title: 'Sour soup',
      displayLocale: 'en',
      availableLocales: ['vi', 'en'],
    });
  });
});
