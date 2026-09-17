-- CreateEnum
CREATE TYPE "FoodVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "visibility" "FoodVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "Food_visibility_idx" ON "Food"("visibility");

-- CreateIndex
CREATE INDEX "Food_createdByUserId_idx" ON "Food"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
