-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "shareCount" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "ContentEventType" AS ENUM ('SHARE', 'VIEW');

-- CreateTable
CREATE TABLE "ContentEvent" (
    "id" TEXT NOT NULL,
    "type" "ContentEventType" NOT NULL,
    "recipeId" TEXT,
    "userId" TEXT,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentEvent_recipeId_type_createdAt_idx" ON "ContentEvent"("recipeId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ContentEvent_userId_recipeId_type_createdAt_idx" ON "ContentEvent"("userId", "recipeId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentEvent" ADD CONSTRAINT "ContentEvent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEvent" ADD CONSTRAINT "ContentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
