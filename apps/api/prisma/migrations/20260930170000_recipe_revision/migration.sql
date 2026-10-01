-- Catalog recipe revisions. Group cookbook recipes are not backfilled.

CREATE TYPE "RecipeModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Recipe" ADD COLUMN "publishedVersion" INTEGER;

CREATE TABLE "RecipeRevision" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "moderationStatus" "RecipeModerationStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER NOT NULL,
    "prepTimeMin" INTEGER,
    "cookTimeMin" INTEGER,
    "difficulty" "RecipeDifficulty" NOT NULL,
    "instructions" TEXT NOT NULL,
    "imageUrl" TEXT,
    "visibility" "RecipeVisibility" NOT NULL,
    "ingredientsJson" JSONB NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "RecipeRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeRevision_recipeId_version_key" ON "RecipeRevision"("recipeId", "version");
CREATE INDEX "RecipeRevision_moderationStatus_createdAt_idx" ON "RecipeRevision"("moderationStatus", "createdAt");

ALTER TABLE "RecipeRevision"
ADD CONSTRAINT "RecipeRevision_recipeId_fkey"
FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing catalog recipes are already live: revision 1 is the published snapshot.
INSERT INTO "RecipeRevision" (
    "id",
    "recipeId",
    "version",
    "moderationStatus",
    "title",
    "description",
    "servings",
    "prepTimeMin",
    "cookTimeMin",
    "difficulty",
    "instructions",
    "imageUrl",
    "visibility",
    "ingredientsJson",
    "stepsJson",
    "createdAt",
    "reviewedAt"
)
SELECT
    'rev_' || r."id",
    r."id",
    1,
    'APPROVED',
    r."title",
    r."description",
    r."servings",
    r."prepTimeMin",
    r."cookTimeMin",
    r."difficulty",
    r."instructions",
    r."imageUrl",
    r."visibility",
    COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'foodId', ri."foodId",
                'quantity', ri."quantity",
                'unit', ri."unit",
                'note', ri."note",
                'optional', ri."optional",
                'sortOrder', ri."sortOrder"
            )
            ORDER BY ri."sortOrder"
        )
        FROM "RecipeIngredient" ri
        WHERE ri."recipeId" = r."id"
    ), '[]'::jsonb),
    COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'body', rs."body",
                'imageUrl', rs."imageUrl",
                'sortOrder', rs."sortOrder"
            )
            ORDER BY rs."sortOrder"
        )
        FROM "RecipeStep" rs
        WHERE rs."recipeId" = r."id"
    ), '[]'::jsonb),
    r."createdAt",
    r."createdAt"
FROM "Recipe" r
WHERE r."groupId" IS NULL;

UPDATE "Recipe"
SET "publishedVersion" = 1
WHERE "groupId" IS NULL;
