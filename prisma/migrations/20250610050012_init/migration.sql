/*
  Warnings:

  - Made the column `exitPrice` on table `Trade` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Trade" ALTER COLUMN "exitPrice" SET NOT NULL;

-- CreateTable
CREATE TABLE "TraderStats" (
    "id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "successfulSignals" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgProfitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestSymbols" JSONB NOT NULL,
    "tradingHours" JSONB NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotStats" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "successfulTrades" INTEGER NOT NULL DEFAULT 0,
    "totalProfitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgProfitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTradeDuration" INTEGER NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectancy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxConsecutiveWins" INTEGER NOT NULL DEFAULT 0,
    "maxConsecutiveLosses" INTEGER NOT NULL DEFAULT 0,
    "avgWinAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgLossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "largestWin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "largestLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestTradingHour" INTEGER,
    "worstTradingHour" INTEGER,
    "bestTradingDay" INTEGER,
    "worstTradingDay" INTEGER,
    "avgTradesPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "busiestTradingDay" TIMESTAMP(3),
    "optionsRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cryptoRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "optionsWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cryptoWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharpeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortinoRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calmarRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "var95" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedShortfall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalChannels" INTEGER NOT NULL DEFAULT 0,
    "activeChannels" INTEGER NOT NULL DEFAULT 0,
    "bestPerformingChannel" TEXT,
    "worstPerformingChannel" TEXT,
    "channelWinRates" JSONB NOT NULL,
    "channelProfitLoss" JSONB NOT NULL,
    "totalTraders" INTEGER NOT NULL DEFAULT 0,
    "activeTraders" INTEGER NOT NULL DEFAULT 0,
    "bestPerformingTrader" TEXT,
    "worstPerformingTrader" TEXT,
    "traderWinRates" JSONB NOT NULL,
    "traderProfitLoss" JSONB NOT NULL,
    "mostTradedSymbol" TEXT,
    "symbolStats" JSONB NOT NULL,
    "sectorPerformance" JSONB NOT NULL,
    "avgSignalLatency" INTEGER NOT NULL DEFAULT 0,
    "signalAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "falsePositiveRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgConfidenceByType" JSONB NOT NULL,
    "uptime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgProcessingTime" INTEGER NOT NULL DEFAULT 0,
    "resourceUtilization" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TraderStats_author_channelId_key" ON "TraderStats"("author", "channelId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_author_channelId_fkey" FOREIGN KEY ("author", "channelId") REFERENCES "TraderStats"("author", "channelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderStats" ADD CONSTRAINT "TraderStats_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
