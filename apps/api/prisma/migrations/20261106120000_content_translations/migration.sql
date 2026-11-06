-- Recipe / Article translations (requirements 2b.2, 2b.4).
-- Legacy text columns stay as a mirror of sourceLocale until clients move to translations.

-- CreateEnum
CREATE TYPE "TranslationOrigin" AS ENUM ('AUTHOR', 'MODERATOR', 'MACHINE');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "sourceLocale" TEXT NOT NULL DEFAULT 'vi';

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "sourceLocale" TEXT NOT NULL DEFAULT 'vi';

-- AlterTable
ALTER TABLE "RecipeRevision" ADD COLUMN     "sourceLocale" TEXT NOT NULL DEFAULT 'vi',
ADD COLUMN     "translationsJson" JSONB;

-- CreateTable
CREATE TABLE "RecipeTranslation" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'AUTHOR',
    "translatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStepTranslation" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "RecipeStepTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredientTranslation" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "RecipeIngredientTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTranslation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'AUTHOR',
    "translatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeTranslation_locale_idx" ON "RecipeTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeTranslation_recipeId_locale_key" ON "RecipeTranslation"("recipeId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStepTranslation_stepId_locale_key" ON "RecipeStepTranslation"("stepId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredientTranslation_ingredientId_locale_key" ON "RecipeIngredientTranslation"("ingredientId", "locale");

-- CreateIndex
CREATE INDEX "ArticleTranslation_locale_idx" ON "ArticleTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTranslation_articleId_locale_key" ON "ArticleTranslation"("articleId", "locale");

-- AddForeignKey
ALTER TABLE "RecipeTranslation" ADD CONSTRAINT "RecipeTranslation_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeTranslation" ADD CONSTRAINT "RecipeTranslation_translatedById_fkey" FOREIGN KEY ("translatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStepTranslation" ADD CONSTRAINT "RecipeStepTranslation_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RecipeStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientTranslation" ADD CONSTRAINT "RecipeIngredientTranslation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "RecipeIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_translatedById_fkey" FOREIGN KEY ("translatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill (2b.4 #1). Seed recipes written in English.
UPDATE "Recipe" SET "sourceLocale" = 'en'
WHERE "slug" IN ('classic-carbonara', 'chicken-tomato-pasta', 'smoke-test-omelette');

UPDATE "RecipeRevision" r SET "sourceLocale" = rc."sourceLocale"
FROM "Recipe" rc WHERE rc."id" = r."recipeId";

-- translationsJson stays NULL on old revisions: the API derives it from title / description / stepsJson.

INSERT INTO "RecipeTranslation" ("id", "recipeId", "locale", "title", "description", "origin", "translatedById", "createdAt", "updatedAt")
SELECT 'rtr_' || r."id", r."id", r."sourceLocale", r."title", r."description", 'AUTHOR', r."authorId", r."createdAt", NOW()
FROM "Recipe" r;

INSERT INTO "RecipeStepTranslation" ("id", "stepId", "locale", "body")
SELECT 'rst_' || s."id", s."id", r."sourceLocale", s."body"
FROM "RecipeStep" s JOIN "Recipe" r ON r."id" = s."recipeId";

INSERT INTO "RecipeIngredientTranslation" ("id", "ingredientId", "locale", "note")
SELECT 'rit_' || i."id", i."id", r."sourceLocale", i."note"
FROM "RecipeIngredient" i JOIN "Recipe" r ON r."id" = i."recipeId"
WHERE i."note" IS NOT NULL AND btrim(i."note") <> '';

INSERT INTO "ArticleTranslation" ("id", "articleId", "locale", "title", "summary", "body", "origin", "translatedById", "createdAt", "updatedAt")
SELECT 'atr_' || a."id", a."id", a."sourceLocale", a."title", a."summary", a."body", 'AUTHOR', a."authorId", a."createdAt", NOW()
FROM "Article" a;
