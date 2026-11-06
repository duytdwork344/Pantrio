-- i18n foundation (requirements 2b.1, 2b.4 #3).

-- User preferred locale; null = Accept-Language / DEFAULT_LOCALE.
ALTER TABLE "User" ADD COLUMN "locale" TEXT;

-- Nutrient names move from nameEn/nameVi columns to a translation table.
CREATE TABLE "NutrientTranslation" (
    "id" TEXT NOT NULL,
    "nutrientId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "NutrientTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NutrientTranslation_nutrientId_locale_key" ON "NutrientTranslation"("nutrientId", "locale");
CREATE INDEX "NutrientTranslation_locale_idx" ON "NutrientTranslation"("locale");

ALTER TABLE "NutrientTranslation"
ADD CONSTRAINT "NutrientTranslation_nutrientId_fkey"
FOREIGN KEY ("nutrientId") REFERENCES "Nutrient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "NutrientTranslation" ("id", "nutrientId", "locale", "name")
SELECT 'ntr_' || "id" || '_vi', "id", 'vi', "nameVi" FROM "Nutrient"
UNION ALL
SELECT 'ntr_' || "id" || '_en', "id", 'en', "nameEn" FROM "Nutrient";

ALTER TABLE "Nutrient" DROP COLUMN "nameEn",
DROP COLUMN "nameVi";
