-- CreateTable
CREATE TABLE "FoodTranslation" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "FoodTranslation_pkey" PRIMARY KEY ("id")
);

-- Migrate existing Food display fields into English translations
INSERT INTO "FoodTranslation" ("id", "foodId", "locale", "name", "category")
SELECT gen_random_uuid()::text, "id", 'en', "name", "category"
FROM "Food";

-- DropIndex
DROP INDEX IF EXISTS "Food_name_idx";
DROP INDEX IF EXISTS "Food_category_idx";

-- AlterTable
ALTER TABLE "Food" DROP COLUMN "name",
DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "FoodTranslation_locale_name_idx" ON "FoodTranslation"("locale", "name");

-- CreateIndex
CREATE INDEX "FoodTranslation_locale_category_idx" ON "FoodTranslation"("locale", "category");

-- CreateIndex
CREATE UNIQUE INDEX "FoodTranslation_foodId_locale_key" ON "FoodTranslation"("foodId", "locale");

-- AddForeignKey
ALTER TABLE "FoodTranslation" ADD CONSTRAINT "FoodTranslation_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
