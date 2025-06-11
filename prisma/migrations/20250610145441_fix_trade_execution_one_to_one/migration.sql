/*
  Warnings:

  - A unique constraint covering the columns `[tradeId]` on the table `ExecutionStats` will be added. If there are existing duplicate values, this will fail.
  - Made the column `entryPrice` on table `Trade` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Trade" ALTER COLUMN "entryPrice" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionStats_tradeId_key" ON "ExecutionStats"("tradeId");
