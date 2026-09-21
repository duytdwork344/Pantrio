-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "InventoryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "inviteExpiresAt" TIMESTAMP(3),
    "inviteMaxUses" INTEGER,
    "inviteUseCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ShoppingList" ADD COLUMN "groupId" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryGroup_inviteCode_key" ON "InventoryGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "InventoryGroup_inviteCode_idx" ON "InventoryGroup"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_userId_key" ON "GroupMembership"("userId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key" ON "GroupMembership"("groupId", "userId");

-- CreateIndex
CREATE INDEX "ShoppingList_groupId_idx" ON "ShoppingList"("groupId");

-- CreateIndex
CREATE INDEX "InventoryItem_groupId_foodId_idx" ON "InventoryItem"("groupId", "foodId");

-- CreateIndex
CREATE INDEX "InventoryItem_groupId_expiryDate_idx" ON "InventoryItem"("groupId", "expiryDate");

-- AddForeignKey
ALTER TABLE "InventoryGroup" ADD CONSTRAINT "InventoryGroup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InventoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InventoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InventoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
