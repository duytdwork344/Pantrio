-- Nutrition catalog (requirements 7b.9). Values hang off FoodNutrient, not Food columns.

CREATE TYPE "NutrientGroup" AS ENUM ('ENERGY', 'MACRO', 'CARB_DETAIL', 'MINERAL', 'VITAMIN', 'OTHER');

CREATE TABLE "Nutrient" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "group" "NutrientGroup" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Nutrient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Nutrient_code_key" ON "Nutrient"("code");

CREATE TABLE "FoodNutrient" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "nutrientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "basisQty" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "basisUnit" TEXT NOT NULL,

    CONSTRAINT "FoodNutrient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodNutrient_foodId_nutrientId_key" ON "FoodNutrient"("foodId", "nutrientId");
CREATE INDEX "FoodNutrient_nutrientId_idx" ON "FoodNutrient"("nutrientId");

ALTER TABLE "FoodNutrient"
ADD CONSTRAINT "FoodNutrient_foodId_fkey"
FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodNutrient"
ADD CONSTRAINT "FoodNutrient_nutrientId_fkey"
FOREIGN KEY ("nutrientId") REFERENCES "Nutrient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
