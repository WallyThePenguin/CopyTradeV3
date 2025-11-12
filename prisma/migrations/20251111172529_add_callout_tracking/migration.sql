-- CreateTable
CREATE TABLE "Callout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "sourceChannelId" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "traderName" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'EQUITY',
    "symbol" TEXT NOT NULL,
    "action" TEXT,
    "strikePrice" REAL,
    "expirationDate" DATETIME,
    "optionType" TEXT,
    "targetEntry" REAL,
    "targetExit" REAL,
    "quantity" INTEGER,
    "confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rawMessage" TEXT,
    "rawAnalysis" TEXT,
    "calloutAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Callout_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalloutMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calloutId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'CALLOUT',
    "quoteSource" TEXT NOT NULL DEFAULT 'robinhood',
    "priceSnapshotId" TEXT,
    "symbol" TEXT NOT NULL,
    "referencePrice" REAL,
    "bidPrice" REAL,
    "askPrice" REAL,
    "markPrice" REAL,
    "instrumentId" TEXT,
    "quoteTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalloutMatch_calloutId_fkey" FOREIGN KEY ("calloutId") REFERENCES "Callout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalloutMatch_priceSnapshotId_fkey" FOREIGN KEY ("priceSnapshotId") REFERENCES "PriceSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstrumentCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'EQUITY',
    "strikePrice" REAL,
    "optionType" TEXT,
    "expirationDate" DATETIME,
    "instrumentUrl" TEXT,
    "chainId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "calloutId" TEXT,
    "tradeId" TEXT,
    CONSTRAINT "PriceSnapshot_calloutId_fkey" FOREIGN KEY ("calloutId") REFERENCES "Callout" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PriceSnapshot_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PriceSnapshot" ("id", "price", "recordedAt", "source", "symbol") SELECT "id", "price", "recordedAt", "source", "symbol" FROM "PriceSnapshot";
DROP TABLE "PriceSnapshot";
ALTER TABLE "new_PriceSnapshot" RENAME TO "PriceSnapshot";
CREATE TABLE "new_Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "optionType" TEXT,
    "strikePrice" REAL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL,
    "quantity" INTEGER NOT NULL,
    "author" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "status" TEXT NOT NULL,
    "entryTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" DATETIME,
    "profitLoss" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "channelId" TEXT NOT NULL,
    "calloutId" TEXT,
    CONSTRAINT "Trade_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_calloutId_fkey" FOREIGN KEY ("calloutId") REFERENCES "Callout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Trade" ("action", "author", "channelId", "createdAt", "entryPrice", "entryTime", "exitPrice", "exitTime", "id", "mode", "optionType", "profitLoss", "quantity", "status", "strikePrice", "symbol", "updatedAt") SELECT "action", "author", "channelId", "createdAt", "entryPrice", "entryTime", "exitPrice", "exitTime", "id", "mode", "optionType", "profitLoss", "quantity", "status", "strikePrice", "symbol", "updatedAt" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
CREATE UNIQUE INDEX "Trade_calloutId_key" ON "Trade"("calloutId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Callout_symbol_idx" ON "Callout"("symbol");

-- CreateIndex
CREATE INDEX "Callout_status_idx" ON "Callout"("status");

-- CreateIndex
CREATE INDEX "CalloutMatch_calloutId_idx" ON "CalloutMatch"("calloutId");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentCache_symbol_strikePrice_optionType_expirationDate_key" ON "InstrumentCache"("symbol", "strikePrice", "optionType", "expirationDate");
