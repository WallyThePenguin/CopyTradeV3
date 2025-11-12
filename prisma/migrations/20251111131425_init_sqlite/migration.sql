-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minConfidence" REAL NOT NULL DEFAULT 0.8,
    "maxTrades" INTEGER NOT NULL DEFAULT 5,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "webhook_url" TEXT,
    "lastAnalyzed" DATETIME,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "avgProfit" REAL NOT NULL DEFAULT 0,
    "performance" REAL NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Trade" (
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
    CONSTRAINT "Trade_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parsedData" TEXT,
    "type" TEXT NOT NULL,
    "modelUsed" TEXT,
    "parsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_author_channelId_fkey" FOREIGN KEY ("author", "channelId") REFERENCES "TraderStats" ("author", "channelId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "symbol" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketUpdate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventDate" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ModelLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "labeledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualLabel_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "triggeredAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "autoExecuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeSignal_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL,
    "executedPrice" REAL NOT NULL,
    "exitPrice" REAL,
    "exitConfidence" REAL,
    "result" TEXT NOT NULL,
    "pnl" REAL,
    "durationSec" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionStats_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "winRate" REAL NOT NULL,
    "avgProfit" REAL NOT NULL,
    "performance" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceHistory_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerOrderId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT,
    "side" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" REAL,
    "status" TEXT,
    "filledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChannelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minConfidence" REAL NOT NULL DEFAULT 0.7,
    "maxTrades" INTEGER NOT NULL DEFAULT 5,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TraderStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "author" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "successfulSignals" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" REAL NOT NULL DEFAULT 0,
    "avgProfitLoss" REAL NOT NULL DEFAULT 0,
    "bestSymbols" TEXT NOT NULL DEFAULT '[]',
    "tradingHours" TEXT NOT NULL DEFAULT '[]',
    "lastActive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraderStats_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "successfulTrades" INTEGER NOT NULL DEFAULT 0,
    "totalProfitLoss" REAL NOT NULL DEFAULT 0,
    "avgProfitLoss" REAL NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "avgConfidence" REAL NOT NULL DEFAULT 0,
    "avgTradeDuration" INTEGER NOT NULL DEFAULT 0,
    "profitFactor" REAL NOT NULL DEFAULT 0,
    "expectancy" REAL NOT NULL DEFAULT 0,
    "maxConsecutiveWins" INTEGER NOT NULL DEFAULT 0,
    "maxConsecutiveLosses" INTEGER NOT NULL DEFAULT 0,
    "avgWinAmount" REAL NOT NULL DEFAULT 0,
    "avgLossAmount" REAL NOT NULL DEFAULT 0,
    "largestWin" REAL NOT NULL DEFAULT 0,
    "largestLoss" REAL NOT NULL DEFAULT 0,
    "bestTradingHour" INTEGER,
    "worstTradingHour" INTEGER,
    "bestTradingDay" INTEGER,
    "worstTradingDay" INTEGER,
    "avgTradesPerDay" REAL NOT NULL DEFAULT 0,
    "busiestTradingDay" DATETIME,
    "optionsRatio" REAL NOT NULL DEFAULT 0,
    "stockRatio" REAL NOT NULL DEFAULT 0,
    "cryptoRatio" REAL NOT NULL DEFAULT 0,
    "optionsWinRate" REAL NOT NULL DEFAULT 0,
    "stockWinRate" REAL NOT NULL DEFAULT 0,
    "cryptoWinRate" REAL NOT NULL DEFAULT 0,
    "maxDrawdown" REAL NOT NULL DEFAULT 0,
    "sharpeRatio" REAL NOT NULL DEFAULT 0,
    "sortinoRatio" REAL NOT NULL DEFAULT 0,
    "calmarRatio" REAL NOT NULL DEFAULT 0,
    "var95" REAL NOT NULL DEFAULT 0,
    "expectedShortfall" REAL NOT NULL DEFAULT 0,
    "totalChannels" INTEGER NOT NULL DEFAULT 0,
    "activeChannels" INTEGER NOT NULL DEFAULT 0,
    "bestPerformingChannel" TEXT,
    "worstPerformingChannel" TEXT,
    "channelWinRates" TEXT NOT NULL DEFAULT '[]',
    "channelProfitLoss" TEXT NOT NULL DEFAULT '[]',
    "totalTraders" INTEGER NOT NULL DEFAULT 0,
    "activeTraders" INTEGER NOT NULL DEFAULT 0,
    "bestPerformingTrader" TEXT,
    "worstPerformingTrader" TEXT,
    "traderWinRates" TEXT NOT NULL DEFAULT '[]',
    "traderProfitLoss" TEXT NOT NULL DEFAULT '[]',
    "mostTradedSymbol" TEXT,
    "symbolStats" TEXT NOT NULL DEFAULT '[]',
    "sectorPerformance" TEXT NOT NULL DEFAULT '[]',
    "avgSignalLatency" INTEGER NOT NULL DEFAULT 0,
    "signalAccuracy" REAL NOT NULL DEFAULT 0,
    "falsePositiveRate" REAL NOT NULL DEFAULT 0,
    "avgConfidenceByType" TEXT NOT NULL DEFAULT '{}',
    "uptime" REAL NOT NULL DEFAULT 0,
    "errorRate" REAL NOT NULL DEFAULT 0,
    "avgProcessingTime" INTEGER NOT NULL DEFAULT 0,
    "resourceUtilization" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExecutionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionAuditLog_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobName" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL,
    "errorText" TEXT
);

-- CreateTable
CREATE TABLE "ModelEvalResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTested" INTEGER NOT NULL,
    "truePositive" INTEGER NOT NULL,
    "trueNegative" INTEGER NOT NULL,
    "falsePositive" INTEGER NOT NULL,
    "falseNegative" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "notes" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Message_discordId_key" ON "Message"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketUpdate_messageId_key" ON "MarketUpdate"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionStats_tradeId_key" ON "ExecutionStats"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRecord_brokerOrderId_key" ON "OrderRecord"("brokerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConfig_channelId_key" ON "ChannelConfig"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "TraderStats_author_channelId_key" ON "TraderStats"("author", "channelId");
