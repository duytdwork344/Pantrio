-- Group cookbook (requirements 4.2c)
-- AlterEnum
ALTER TYPE "RecipeVisibility" ADD VALUE 'GROUP';

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Recipe_groupId_idx" ON "Recipe"("groupId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InventoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
