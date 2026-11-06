import { HttpStatus } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  ErrorCode,
  isSupportedLocale,
  localeChain,
  matchLocale,
} from '@pantrio/shared';
import { Prisma, TranslationOrigin } from '@prisma/client';
import { AppException } from '../common/errors/app-exception';
import { currentLocale } from '../common/i18n/request-locale';

/**
 * Text of a recipe in one locale (requirements 2b.2). Structure (step order and
 * images, ingredients, times…) is shared by every locale; only this varies.
 *
 * `steps[i]` is the body of the i-th step in step order. `notes` maps foodId →
 * ingredient note. A locale is *complete* when the title and every step body are
 * filled; only complete locales count as available or are shown to readers.
 */
export type RecipeText = {
  locale: string;
  title: string;
  description: string | null;
  steps: string[];
  notes: Record<string, string>;
  origin: TranslationOrigin;
  translatedById: string | null;
};

/** Translation input from authors / moderators (all locales except the source). */
export type RecipeTextInput = {
  locale: string;
  title: string;
  description?: string | null;
  steps: string[];
  notes?: Array<{ foodId: string; note: string }>;
};

export function isComplete(text: RecipeText, stepCount: number): boolean {
  return (
    text.title.trim().length > 0 &&
    text.steps.length === stepCount &&
    text.steps.every((body) => body.trim().length > 0)
  );
}

/** Complete locales, source first. */
export function availableLocales(
  texts: RecipeText[],
  sourceLocale: string,
  stepCount: number,
): string[] {
  return texts
    .filter((text) => isComplete(text, stepCount))
    .map((text) => text.locale)
    .sort((a, b) => Number(b === sourceLocale) - Number(a === sourceLocale));
}

/**
 * Text to show a reader of `locale`: the first complete locale on its fallback
 * chain, else the source text (requirements 2b.2 #6).
 */
export function resolveText(
  texts: RecipeText[],
  sourceLocale: string,
  locale: string,
  stepCount: number,
): { text: RecipeText; displayLocale: string } {
  const complete = texts.filter((text) => isComplete(text, stepCount));
  for (const code of localeChain(locale)) {
    const hit = complete.find((text) => text.locale === code);
    if (hit) return { text: hit, displayLocale: hit.locale };
  }
  const source =
    texts.find((text) => text.locale === sourceLocale) ??
    complete[0] ??
    texts[0];
  return { text: source, displayLocale: source.locale };
}

/** Keep `steps` the same length as the structure; extra bodies drop, missing are ''. */
export function alignSteps(text: RecipeText, stepCount: number): RecipeText {
  const steps = text.steps.slice(0, stepCount);
  while (steps.length < stepCount) steps.push('');
  return { ...text, steps };
}

type RecipeRows = {
  sourceLocale: string;
  authorId: string;
  title: string;
  description: string | null;
  translations?: Array<{
    locale: string;
    title: string;
    description: string | null;
    origin: TranslationOrigin;
    translatedById: string | null;
  }>;
  steps: Array<{
    body: string;
    translations?: Array<{ locale: string; body: string }>;
  }>;
  ingredients: Array<{
    foodId: string;
    note: string | null;
    translations?: Array<{ locale: string; note: string }>;
  }>;
};

/**
 * Texts from the translation tables. A recipe saved before 2b (or a draft
 * overlay without rows) falls back to the legacy columns as its source text.
 */
export function textsFromRows(recipe: RecipeRows): RecipeText[] {
  const rows = recipe.translations ?? [];
  const texts: RecipeText[] = rows.map((row) => ({
    locale: row.locale,
    title: row.title,
    description: row.description,
    steps: recipe.steps.map(
      (step) =>
        step.translations?.find((t) => t.locale === row.locale)?.body ?? '',
    ),
    notes: Object.fromEntries(
      recipe.ingredients.flatMap((item) => {
        const note = item.translations?.find(
          (t) => t.locale === row.locale,
        )?.note;
        return note ? [[item.foodId, note]] : [];
      }),
    ),
    origin: row.origin,
    translatedById: row.translatedById,
  }));
  if (!texts.some((text) => text.locale === recipe.sourceLocale)) {
    texts.unshift(legacyText(recipe));
  }
  return texts;
}

function legacyText(recipe: RecipeRows): RecipeText {
  return {
    locale: recipe.sourceLocale,
    title: recipe.title,
    description: recipe.description,
    steps: recipe.steps.map((step) => step.body),
    notes: Object.fromEntries(
      recipe.ingredients.flatMap((item) =>
        item.note ? [[item.foodId, item.note]] : [],
      ),
    ),
    origin: TranslationOrigin.AUTHOR,
    translatedById: recipe.authorId,
  };
}

/** Texts of a revision snapshot; null translationsJson = saved before 2b. */
export function textsFromRevision(
  revision: {
    sourceLocale: string;
    title: string;
    description: string | null;
    translationsJson: Prisma.JsonValue | null;
  },
  steps: Array<{ body: string }>,
  ingredients: Array<{ foodId: string; note?: string | null }>,
  authorId: string,
): RecipeText[] {
  const parsed = parseTexts(revision.translationsJson);
  if (parsed.length)
    return parsed.map((text) => alignSteps(text, steps.length));
  return [
    legacyText({
      sourceLocale: revision.sourceLocale,
      authorId,
      title: revision.title,
      description: revision.description,
      steps,
      ingredients: ingredients.map((item) => ({
        foodId: item.foodId,
        note: item.note ?? null,
      })),
    }),
  ];
}

function parseTexts(value: Prisma.JsonValue | null): RecipeText[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.locale !== 'string' || typeof row.title !== 'string')
      return [];
    const notes =
      row.notes && typeof row.notes === 'object' && !Array.isArray(row.notes)
        ? Object.fromEntries(
            Object.entries(row.notes as Record<string, unknown>).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string',
            ),
          )
        : {};
    const origin = Object.values(TranslationOrigin).includes(
      row.origin as TranslationOrigin,
    )
      ? (row.origin as TranslationOrigin)
      : TranslationOrigin.AUTHOR;
    return [
      {
        locale: row.locale,
        title: row.title,
        description:
          typeof row.description === 'string' ? row.description : null,
        steps: Array.isArray(row.steps)
          ? row.steps.map((s) => (typeof s === 'string' ? s : ''))
          : [],
        notes,
        origin,
        translatedById:
          typeof row.translatedById === 'string' ? row.translatedById : null,
      },
    ];
  });
}

export function textsToJson(texts: RecipeText[]): Prisma.InputJsonValue {
  return texts;
}

function sameText(a: RecipeText, b: RecipeText): boolean {
  return (
    a.title === b.title &&
    (a.description ?? null) === (b.description ?? null) &&
    a.steps.length === b.steps.length &&
    a.steps.every((body, i) => body === b.steps[i]) &&
    JSON.stringify(a.notes) === JSON.stringify(b.notes)
  );
}

/**
 * Validate one translation input against the structure. A tab is either empty
 * (not sent) or complete — never half-filled (requirements 2b.2 #5).
 */
export function textFromInput(
  input: RecipeTextInput,
  stepCount: number,
  foodIds: Set<string>,
  origin: TranslationOrigin,
  translatedById: string,
): RecipeText {
  const locale = matchLocale(input.locale);
  if (!locale || !isSupportedLocale(locale)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LOCALE_NOT_SUPPORTED,
      `Locale '${input.locale}' is not supported`,
      { locale: input.locale },
    );
  }
  const steps = (input.steps ?? []).map((body) => body.trim());
  const text: RecipeText = {
    locale,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    steps,
    notes: Object.fromEntries(
      (input.notes ?? [])
        .map((item) => [item.foodId, item.note.trim()] as const)
        .filter(([foodId, note]) => note && foodIds.has(foodId)),
    ),
    origin,
    translatedById,
  };
  if (!isComplete(text, stepCount)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.TRANSLATION_INCOMPLETE,
      `Translation '${locale}' needs a title and all ${stepCount} step(s)`,
      { locale, steps: stepCount },
    );
  }
  return text;
}

/**
 * Next set of texts after a write.
 *
 * - `source` is the flat title / description / steps / notes of the request,
 *   written in `sourceLocale`.
 * - `translations` (when sent) replaces every other locale; a locale left out
 *   is removed. When not sent, other locales are kept and re-aligned to the
 *   new step count (they turn incomplete if steps were added).
 * - An unchanged translation keeps its origin and translator.
 */
export function mergeTexts(params: {
  base: RecipeText[];
  sourceLocale: string;
  source: Omit<RecipeText, 'locale' | 'origin' | 'translatedById'>;
  translations?: RecipeTextInput[];
  stepCount: number;
  foodIds: Set<string>;
  actorId: string;
}): RecipeText[] {
  const { base, sourceLocale, stepCount, foodIds, actorId } = params;
  const previous = new Map(base.map((text) => [text.locale, text]));
  const sourceDraft: RecipeText = {
    ...params.source,
    locale: sourceLocale,
    origin: TranslationOrigin.AUTHOR,
    translatedById: actorId,
  };
  const keepIfSame = (next: RecipeText): RecipeText => {
    const before = previous.get(next.locale);
    return before && sameText(before, next)
      ? {
          ...next,
          origin: before.origin,
          translatedById: before.translatedById,
        }
      : next;
  };

  const others: RecipeText[] = [];
  if (params.translations) {
    const seen = new Set<string>();
    for (const input of params.translations) {
      const text = textFromInput(
        input,
        stepCount,
        foodIds,
        TranslationOrigin.AUTHOR,
        actorId,
      );
      if (text.locale === sourceLocale) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.TRANSLATION_IS_SOURCE,
          `'${text.locale}' is the source locale; send it as the main fields`,
          { locale: text.locale },
        );
      }
      if (seen.has(text.locale)) continue;
      seen.add(text.locale);
      others.push(keepIfSame(text));
    }
  } else {
    for (const text of base) {
      if (text.locale !== sourceLocale)
        others.push(alignSteps(text, stepCount));
    }
  }
  return [keepIfSame(sourceDraft), ...others];
}

/** Rewrite note keys after private foods are merged at approval. */
export function remapNotes(
  texts: RecipeText[],
  mapFoodId: (foodId: string) => string,
): RecipeText[] {
  return texts.map((text) => {
    const notes: Record<string, string> = {};
    for (const [foodId, note] of Object.entries(text.notes)) {
      const target = mapFoodId(foodId);
      if (!(target in notes)) notes[target] = note;
    }
    return { ...text, notes };
  });
}

/**
 * Replace the translation rows of a recipe. Steps / ingredients must already be
 * written; `stepIds` follows step order and `ingredientIdByFood` maps foodId.
 * Also mirrors the source text into the legacy columns.
 */
export async function writeTexts(
  tx: Prisma.TransactionClient,
  params: {
    recipeId: string;
    sourceLocale: string;
    texts: RecipeText[];
    stepIds: string[];
    ingredientIdByFood: Map<string, string>;
  },
): Promise<void> {
  const { recipeId, sourceLocale, texts, stepIds, ingredientIdByFood } = params;
  await tx.recipeTranslation.deleteMany({ where: { recipeId } });
  await tx.recipeStepTranslation.deleteMany({
    where: { stepId: { in: stepIds } },
  });
  await tx.recipeIngredientTranslation.deleteMany({
    where: { ingredientId: { in: [...ingredientIdByFood.values()] } },
  });

  for (const text of texts) {
    await tx.recipeTranslation.create({
      data: {
        recipeId,
        locale: text.locale,
        title: text.title,
        description: text.description,
        origin: text.origin,
        translatedById: text.translatedById,
      },
    });
  }
  const stepRows = texts.flatMap((text) =>
    stepIds.flatMap((stepId, i) => {
      const body = text.steps[i]?.trim();
      return body ? [{ stepId, locale: text.locale, body }] : [];
    }),
  );
  if (stepRows.length)
    await tx.recipeStepTranslation.createMany({ data: stepRows });
  const noteRows = texts.flatMap((text) =>
    Object.entries(text.notes).flatMap(([foodId, note]) => {
      const ingredientId = ingredientIdByFood.get(foodId);
      return ingredientId && note.trim()
        ? [{ ingredientId, locale: text.locale, note: note.trim() }]
        : [];
    }),
  );
  if (noteRows.length)
    await tx.recipeIngredientTranslation.createMany({ data: noteRows });

  const source = texts.find((text) => text.locale === sourceLocale);
  if (source) {
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        sourceLocale,
        title: source.title,
        description: source.description,
        instructions: source.steps.join('\n'),
      },
    });
    for (const [i, stepId] of stepIds.entries()) {
      const body = source.steps[i];
      if (body)
        await tx.recipeStep.update({ where: { id: stepId }, data: { body } });
    }
    for (const [foodId, ingredientId] of ingredientIdByFood) {
      await tx.recipeIngredient.update({
        where: { id: ingredientId },
        data: { note: source.notes[foodId] ?? null },
      });
    }
  }
}

/** Prisma include for list views: titles per locale + which locales cover every step. */
export const recipeHeaderInclude = {
  translations: true,
  steps: { select: { translations: { select: { locale: true } } } },
} satisfies Prisma.RecipeInclude;

/**
 * Title / description for list cards in `locale`, with the same completeness
 * rule as the detail page so a card never promises a translation it lacks.
 */
export function localizedHeader(
  recipe: {
    sourceLocale: string;
    title: string;
    description: string | null;
    translations?: Array<{
      locale: string;
      title: string;
      description: string | null;
    }>;
    steps?: Array<{ translations: Array<{ locale: string }> }>;
  },
  locale: string,
): {
  title: string;
  description: string | null;
  sourceLocale: string;
  displayLocale: string;
  availableLocales: string[];
} {
  const steps = recipe.steps ?? [];
  const rows = recipe.translations ?? [];
  const complete = rows.filter(
    (row) =>
      row.title.trim() &&
      steps.every((step) =>
        step.translations.some((t) => t.locale === row.locale),
      ),
  );
  const available = complete
    .map((row) => row.locale)
    .sort(
      (a, b) =>
        Number(b === recipe.sourceLocale) - Number(a === recipe.sourceLocale),
    );
  const chosen =
    localeChain(locale)
      .map((code) => complete.find((row) => row.locale === code))
      .find(Boolean) ?? rows.find((row) => row.locale === recipe.sourceLocale);
  return {
    title: chosen?.title ?? recipe.title,
    description: chosen ? chosen.description : recipe.description,
    sourceLocale: recipe.sourceLocale,
    displayLocale: chosen?.locale ?? recipe.sourceLocale,
    availableLocales: available.length ? available : [recipe.sourceLocale],
  };
}

/**
 * Title / description of a recipe card in the request locale, for modules that
 * embed recipes (cooking, planning, articles). Load the recipe with
 * `recipeHeaderInclude`; without it the legacy (source) columns are used.
 */
export function recipeCardText(recipe: {
  title: string;
  description: string | null;
  sourceLocale?: string;
  translations?: Array<{
    locale: string;
    title: string;
    description: string | null;
  }>;
  steps?: Array<{ translations: Array<{ locale: string }> }>;
}): { title: string; description: string | null } {
  const header = localizedHeader(
    { ...recipe, sourceLocale: recipe.sourceLocale ?? DEFAULT_LOCALE },
    currentLocale(),
  );
  return { title: header.title, description: header.description };
}
