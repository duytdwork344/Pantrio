import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecipeDifficulty, RecipeVisibility } from '@prisma/client';
import { Client } from '@opensearch-project/opensearch';
import { SUPPORTED_LOCALES, localeChain } from '@pantrio/shared';
import { currentLocale } from '../common/i18n/request-locale';
import { PrismaService } from '../prisma/prisma.service';
import {
  availableLocales,
  localizedHeader,
  recipeHeaderInclude,
  textsFromRows,
} from '../recipes/recipe-content';
import type { RecipeSearchHitDto } from './dto/search.dto';

/** Text of one locale in the index (requirements 2b.1 #10). */
type LocalizedFields = {
  title: string;
  description: string | null;
  instructions: string;
};

/** Recipe + translations + step texts: everything toDocument reads. */
const documentInclude = {
  translations: true,
  steps: {
    include: { translations: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  ingredients: {
    include: { translations: true, food: { include: { translations: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
};

export type RecipeSearchDocument = {
  id: string;
  /** Source-locale title (legacy field; search uses content.<locale>.*). */
  title: string;
  slug: string;
  description: string | null;
  servings: number;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  difficulty: RecipeDifficulty;
  imageUrl: string | null;
  shareCount: number;
  visibility: RecipeVisibility;
  publishedVersion: number;
  ingredientNames: string[];
  ingredientFoodIds: string[];
  instructions: string;
  sourceLocale: string;
  /** Locales with a complete translation. */
  locales: string[];
  content: Record<string, LocalizedFields>;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client | null;
  private readonly index: string;
  private readonly enabled: boolean;
  private ready = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled =
      (this.config.get<string>('SEARCH_ENABLED') ?? 'true') !== 'false';
    this.index =
      this.config.get<string>('SEARCH_INDEX_RECIPES') ?? 'pantrio-recipes';
    const node =
      this.config.get<string>('OPENSEARCH_NODE') ?? 'http://localhost:9200';
    this.client = this.enabled
      ? new Client({ node, ssl: { rejectUnauthorized: false } })
      : null;
  }

  async onModuleInit() {
    if (!this.client) {
      this.logger.warn('OpenSearch disabled; recipe search uses SQL fallback');
      return;
    }
    try {
      await this.ensureIndex();
      const count = await this.countDocuments();
      if (count === 0) {
        const result = await this.reindexPublicRecipes();
        this.logger.log(
          `OpenSearch ready; bootstrapped ${result.indexed} public recipes`,
        );
      } else {
        this.logger.log(`OpenSearch ready; index has ${count} recipes`);
      }
      this.ready = true;
    } catch (error) {
      this.ready = false;
      this.logger.warn(
        `OpenSearch unavailable (${String(error)}). Recipe search falls back to SQL until it recovers.`,
      );
    }
  }

  isOpenSearchReady() {
    return Boolean(this.client && this.ready);
  }

  async upsertPublicRecipe(recipeId: string): Promise<void> {
    const doc = await this.loadPublicDocument(recipeId);
    if (!doc) {
      await this.removeRecipe(recipeId);
      return;
    }
    if (!this.client || !this.ready) return;
    try {
      await this.client.index({
        index: this.index,
        id: doc.id,
        body: doc,
        refresh: true,
      });
    } catch (error) {
      this.logger.warn(`Failed to index recipe ${recipeId}: ${String(error)}`);
      this.ready = false;
    }
  }

  async removeRecipe(recipeId: string): Promise<void> {
    if (!this.client || !this.ready) return;
    try {
      await this.client.delete({
        index: this.index,
        id: recipeId,
        refresh: true,
      });
    } catch (error) {
      const status = (error as { meta?: { statusCode?: number } })?.meta
        ?.statusCode;
      if (status !== 404) {
        this.logger.warn(
          `Failed to delete recipe ${recipeId} from index: ${String(error)}`,
        );
      }
    }
  }

  async searchRecipes(params: {
    q?: string;
    difficulty?: RecipeDifficulty;
    maxCookTimeMin?: number;
    limit?: number;
  }): Promise<{ hits: RecipeSearchHitDto[]; backend: 'opensearch' | 'sql' }> {
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    if (this.client && this.ready) {
      try {
        const hits = await this.searchOpenSearch(params, limit);
        return { hits, backend: 'opensearch' };
      } catch (error) {
        this.logger.warn(
          `OpenSearch query failed, SQL fallback: ${String(error)}`,
        );
        this.ready = false;
      }
    }
    const hits = await this.searchSql(params, limit);
    return { hits, backend: 'sql' };
  }

  async reindexPublicRecipes(): Promise<{
    indexed: number;
    removed: number;
    backend: string;
  }> {
    if (!this.client) {
      return { indexed: 0, removed: 0, backend: 'sql-fallback' };
    }
    await this.ensureIndex();
    const recipes = await this.prisma.recipe.findMany({
      where: {
        visibility: RecipeVisibility.PUBLIC,
        groupId: null,
        publishedVersion: { not: null },
      },
      include: documentInclude,
    });

    let indexed = 0;
    for (const recipe of recipes) {
      const doc = this.toDocument(recipe);
      await this.client.index({
        index: this.index,
        id: doc.id,
        body: doc,
      });
      indexed += 1;
    }

    // Drop stale docs that are no longer public/published.
    const keep = new Set(recipes.map((recipe) => recipe.id));
    let removed = 0;
    const scroll = await this.client.search({
      index: this.index,
      size: 200,
      body: { query: { match_all: {} }, _source: false },
    });
    const hits = (scroll.body.hits?.hits ?? []) as Array<{ _id: string }>;
    for (const hit of hits) {
      if (!keep.has(hit._id)) {
        await this.client.delete({ index: this.index, id: hit._id });
        removed += 1;
      }
    }
    await this.client.indices.refresh({ index: this.index });
    this.ready = true;
    return { indexed, removed, backend: 'opensearch' };
  }

  private async searchOpenSearch(
    params: {
      q?: string;
      difficulty?: RecipeDifficulty;
      maxCookTimeMin?: number;
      limit?: number;
    },
    limit: number,
  ): Promise<RecipeSearchHitDto[]> {
    const filter: object[] = [
      { term: { visibility: RecipeVisibility.PUBLIC } },
    ];
    if (params.difficulty) {
      filter.push({ term: { difficulty: params.difficulty } });
    }
    if (params.maxCookTimeMin != null) {
      filter.push({
        bool: {
          should: [
            { range: { cookTimeMin: { lte: params.maxCookTimeMin } } },
            { bool: { must_not: { exists: { field: 'cookTimeMin' } } } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    const q = params.q?.trim();
    const query = q
      ? {
          bool: {
            filter,
            must: [
              {
                multi_match: {
                  query: q,
                  // Every language: readers may type the dish in any of them.
                  fields: [
                    'content.*.title^4',
                    'content.*.description^2',
                    'ingredientNames^3',
                    'content.*.instructions',
                  ],
                  fuzziness: 'AUTO',
                  operator: 'and' as const,
                },
              },
            ],
          },
        }
      : { bool: { filter } };

    const response = await this.client!.search({
      index: this.index,
      size: limit,
      body: {
        query,
        sort: q
          ? [{ _score: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }],
      },
    });

    const hits = (response.body.hits?.hits ?? []) as Array<{
      _score?: number;
      _source?: RecipeSearchDocument;
    }>;
    return hits
      .filter((hit) => hit._source)
      .map((hit) => this.toHit(hit._source!, hit._score));
  }

  private async searchSql(
    params: {
      q?: string;
      difficulty?: RecipeDifficulty;
      maxCookTimeMin?: number;
    },
    limit: number,
  ): Promise<RecipeSearchHitDto[]> {
    const q = params.q?.trim();
    const recipes = await this.prisma.recipe.findMany({
      where: {
        visibility: RecipeVisibility.PUBLIC,
        groupId: null,
        publishedVersion: { not: null },
        ...(params.difficulty ? { difficulty: params.difficulty } : {}),
        ...(params.maxCookTimeMin != null
          ? {
              OR: [
                { cookTimeMin: { lte: params.maxCookTimeMin } },
                { cookTimeMin: null },
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { instructions: { contains: q, mode: 'insensitive' } },
                {
                  translations: {
                    some: {
                      OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
                {
                  ingredients: {
                    some: {
                      food: {
                        translations: {
                          some: {
                            name: { contains: q, mode: 'insensitive' },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: recipeHeaderInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return recipes.map((recipe) => {
      const header = localizedHeader(recipe, recipe.sourceLocale);
      return this.toHit({
        id: recipe.id,
        title: recipe.title,
        slug: recipe.slug,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMin: recipe.prepTimeMin,
        cookTimeMin: recipe.cookTimeMin,
        difficulty: recipe.difficulty,
        imageUrl: recipe.imageUrl,
        shareCount: recipe.shareCount,
        visibility: recipe.visibility,
        publishedVersion: recipe.publishedVersion ?? 0,
        ingredientNames: [],
        ingredientFoodIds: [],
        instructions: recipe.instructions,
        sourceLocale: recipe.sourceLocale,
        locales: header.availableLocales,
        content: Object.fromEntries(
          (recipe.translations ?? []).map((row) => [
            row.locale,
            {
              title: row.title,
              description: row.description,
              instructions: '',
            },
          ]),
        ),
        createdAt: recipe.createdAt.toISOString(),
        updatedAt: recipe.updatedAt.toISOString(),
      });
    });
  }

  private async ensureIndex() {
    if (!this.client) return;
    const exists = await this.client.indices.exists({ index: this.index });
    if (exists.body) {
      // Index made before per-locale content (2b): drop it; boot reindexes.
      const mapping = await this.client.indices.getMapping({
        index: this.index,
      });
      const props = (
        Object.values(mapping.body ?? {})[0] as
          { mappings?: { properties?: Record<string, unknown> } } | undefined
      )?.mappings?.properties;
      if (props?.content) return;
      this.logger.log(`Recreating ${this.index} with per-locale fields`);
      await this.client.indices.delete({ index: this.index });
    }
    const text = { type: 'text', analyzer: 'pantrio_text' } as const;
    const localized = {
      type: 'object',
      properties: { title: text, description: text, instructions: text },
    } as const;
    await this.client.indices.create({
      index: this.index,
      body: {
        settings: {
          analysis: {
            analyzer: {
              pantrio_text: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'pantrio_text',
              fields: { keyword: { type: 'keyword' } },
            },
            slug: { type: 'keyword' },
            description: { type: 'text', analyzer: 'pantrio_text' },
            servings: { type: 'integer' },
            prepTimeMin: { type: 'integer' },
            cookTimeMin: { type: 'integer' },
            difficulty: { type: 'keyword' },
            imageUrl: { type: 'keyword', index: false },
            shareCount: { type: 'integer' },
            visibility: { type: 'keyword' },
            publishedVersion: { type: 'integer' },
            ingredientNames: { type: 'text', analyzer: 'pantrio_text' },
            ingredientFoodIds: { type: 'keyword' },
            instructions: { type: 'text', analyzer: 'pantrio_text' },
            sourceLocale: { type: 'keyword' },
            locales: { type: 'keyword' },
            // vi keeps asciifolding; CJK locales will need an ICU analyzer (2b.1 #10).
            content: {
              properties: Object.fromEntries(
                SUPPORTED_LOCALES.map((code) => [code, localized]),
              ),
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });
  }

  private async countDocuments(): Promise<number> {
    if (!this.client) return 0;
    const result = await this.client.count({ index: this.index });
    return Number(result.body.count ?? 0);
  }

  private async loadPublicDocument(
    recipeId: string,
  ): Promise<RecipeSearchDocument | null> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: documentInclude,
    });
    if (
      !recipe ||
      recipe.groupId ||
      recipe.visibility !== RecipeVisibility.PUBLIC ||
      recipe.publishedVersion == null
    ) {
      return null;
    }
    return this.toDocument(recipe);
  }

  private toDocument(recipe: {
    id: string;
    authorId: string;
    sourceLocale: string;
    title: string;
    slug: string;
    description: string | null;
    servings: number;
    prepTimeMin: number | null;
    cookTimeMin: number | null;
    difficulty: RecipeDifficulty;
    imageUrl: string | null;
    shareCount: number;
    visibility: RecipeVisibility;
    publishedVersion: number | null;
    instructions: string;
    createdAt: Date;
    updatedAt: Date;
    translations: Parameters<typeof textsFromRows>[0]['translations'];
    steps: Array<{
      body: string;
      translations: Array<{ locale: string; body: string }>;
    }>;
    ingredients: Array<{
      foodId: string;
      note: string | null;
      translations: Array<{ locale: string; note: string }>;
      food: {
        translations: Array<{ locale: string; name: string }>;
      };
    }>;
  }): RecipeSearchDocument {
    const ingredientNames = recipe.ingredients.flatMap((item) =>
      item.food.translations.map((row) => row.name),
    );
    const texts = textsFromRows(recipe);
    const locales = availableLocales(
      texts,
      recipe.sourceLocale,
      recipe.steps.length,
    );
    return {
      id: recipe.id,
      title: recipe.title,
      slug: recipe.slug,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
      shareCount: recipe.shareCount,
      visibility: recipe.visibility,
      publishedVersion: recipe.publishedVersion ?? 0,
      ingredientNames: [...new Set(ingredientNames)],
      ingredientFoodIds: recipe.ingredients.map((item) => item.foodId),
      instructions: recipe.instructions,
      sourceLocale: recipe.sourceLocale,
      locales,
      content: Object.fromEntries(
        texts
          .filter((text) => locales.includes(text.locale))
          .map((text) => [
            text.locale,
            {
              title: text.title,
              description: text.description,
              instructions: text.steps.join('\n'),
            },
          ]),
      ),
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    };
  }

  private toHit(doc: RecipeSearchDocument, score?: number): RecipeSearchHitDto {
    const locales = doc.locales?.length
      ? doc.locales
      : [doc.sourceLocale ?? 'vi'];
    const displayLocale =
      localeChain(currentLocale()).find(
        (code) => locales.includes(code) && doc.content?.[code],
      ) ?? doc.sourceLocale;
    const shown = (displayLocale && doc.content?.[displayLocale]) || {
      title: doc.title,
      description: doc.description,
    };
    return {
      id: doc.id,
      title: shown.title,
      slug: doc.slug,
      description: shown.description,
      sourceLocale: doc.sourceLocale,
      displayLocale: displayLocale ?? doc.sourceLocale,
      availableLocales: locales,
      servings: doc.servings,
      prepTimeMin: doc.prepTimeMin,
      cookTimeMin: doc.cookTimeMin,
      difficulty: doc.difficulty,
      imageUrl: doc.imageUrl,
      shareCount: doc.shareCount,
      ...(score != null ? { score } : {}),
    };
  }
}
