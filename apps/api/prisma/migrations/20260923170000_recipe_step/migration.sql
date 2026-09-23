-- RecipeStep (requirements 4.2e)
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipeStep_recipeId_sortOrder_idx" ON "RecipeStep"("recipeId", "sortOrder");

ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: split instructions by newline into steps when none exist yet.
INSERT INTO "RecipeStep" ("id", "recipeId", "sortOrder", "body", "imageUrl")
SELECT
  'step_' || r."id" || '_' || gs.ord::text,
  r."id",
  (gs.ord - 1)::int,
  gs.line,
  NULL
FROM "Recipe" r
CROSS JOIN LATERAL (
  SELECT
    row_number() OVER () AS ord,
    trim(both FROM t.line) AS line
  FROM unnest(string_to_array(r."instructions", E'\n')) AS t(line)
  WHERE length(trim(both from t.line)) > 0
) gs
WHERE NOT EXISTS (
  SELECT 1 FROM "RecipeStep" s WHERE s."recipeId" = r."id"
);
