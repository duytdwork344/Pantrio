-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "NutritionTargetSource" AS ENUM ('COMPUTED', 'MANUAL', 'PRESET');

-- CreateEnum
CREATE TYPE "NutritionPresetCode" AS ENUM ('CHILD_4_8', 'CHILD_9_13', 'TEEN_14_17', 'ADULT_DEFAULT', 'OLDER_65');

-- CreateTable
CREATE TABLE "UserNutritionTarget" (
    "userId" TEXT NOT NULL,
    "sex" "Sex",
    "ageYears" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "activity" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
    "source" "NutritionTargetSource" NOT NULL DEFAULT 'COMPUTED',
    "presetCode" "NutritionPresetCode",
    "energyKcal" INTEGER NOT NULL,
    "proteinG" INTEGER NOT NULL,
    "fatG" INTEGER NOT NULL,
    "carbG" INTEGER NOT NULL,
    "bmrKcal" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNutritionTarget_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserNutritionTarget" ADD CONSTRAINT "UserNutritionTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
