/*
  Warnings:

  - Added the required column `type` to the `ExecutionAuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExecutionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "channelId" TEXT,
    "type" TEXT NOT NULL,
    "statusCode" INTEGER,
    "rawResponse" TEXT DEFAULT '{}',
    "durationMs" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionAuditLog_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExecutionAuditLog" ("id", "timestamp", "tradeId") SELECT "id", "timestamp", "tradeId" FROM "ExecutionAuditLog";
DROP TABLE "ExecutionAuditLog";
ALTER TABLE "new_ExecutionAuditLog" RENAME TO "ExecutionAuditLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
