-- CreateTable
CREATE TABLE "ArticleRecipe" (
    "articleId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleRecipe_pkey" PRIMARY KEY ("articleId","recipeId")
);

-- CreateIndex
CREATE INDEX "ArticleRecipe_recipeId_idx" ON "ArticleRecipe"("recipeId");

-- AddForeignKey
ALTER TABLE "ArticleRecipe" ADD CONSTRAINT "ArticleRecipe_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRecipe" ADD CONSTRAINT "ArticleRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
