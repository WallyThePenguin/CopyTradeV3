import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Seed Channels
    const channel1 = await prisma.channel.upsert({
        where: { id: 'channel-1' },
        update: {},
        create: {
            id: 'channel-1',
            name: 'AlphaTrader',
            type: 'DISCORD',
            enabled: true,
            minConfidence: 0.85,
            maxTrades: 10,
            riskLevel: 'HIGH',
            webhook_url: 'https://discord.com/api/webhooks/alpha',
            totalTrades: 20,
            winRate: 0.65,
            avgProfit: 120.5,
            performance: 0.8,
        },
    });
    const channel2 = await prisma.channel.upsert({
        where: { id: 'channel-2' },
        update: {},
        create: {
            id: 'channel-2',
            name: 'BetaTrader',
            type: 'DISCORD',
            enabled: true,
            minConfidence: 0.8,
            maxTrades: 5,
            riskLevel: 'MEDIUM',
            webhook_url: 'https://discord.com/api/webhooks/beta',
            totalTrades: 15,
            winRate: 0.55,
            avgProfit: 80.2,
            performance: 0.6,
        },
    });

    // Seed TraderStats FIRST for referenced authors/channelIds
    await prisma.traderStats.createMany({
        data: [
            {
                id: 'ts-1',
                author: 'TraderJoe',
                channelId: channel1.id,
                totalSignals: 10,
                successfulSignals: 7,
                avgConfidence: 0.85,
                avgProfitLoss: 120.0,
                bestSymbols: JSON.stringify([{ symbol: 'AAPL', winRate: 0.7, totalTrades: 5 }]),
                tradingHours: JSON.stringify([{ hour: 10, winRate: 0.8, totalTrades: 3 }]),
                lastActive: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'ts-2',
                author: 'TraderJane',
                channelId: channel2.id,
                totalSignals: 8,
                successfulSignals: 5,
                avgConfidence: 0.8,
                avgProfitLoss: 80.0,
                bestSymbols: JSON.stringify([{ symbol: 'TSLA', winRate: 0.6, totalTrades: 4 }]),
                tradingHours: JSON.stringify([{ hour: 11, winRate: 0.7, totalTrades: 2 }]),
                lastActive: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
        skipDuplicates: true,
    });

    // Seed Trades
    await prisma.trade.createMany({
        data: [
            {
                id: 'trade-1',
                symbol: 'AAPL',
                action: 'BUY',
                entryPrice: 150.0,
                exitPrice: 155.0,
                quantity: 10,
                mode: 'SIMULATED',
                status: 'SUCCESS',
                entryTime: new Date(),
                exitTime: new Date(),
                profitLoss: 50.0,
                channelId: channel1.id,
            },
            {
                id: 'trade-2',
                symbol: 'TSLA',
                action: 'SELL',
                entryPrice: 700.0,
                exitPrice: 690.0,
                quantity: 5,
                mode: 'SIMULATED',
                status: 'FAILED',
                entryTime: new Date(),
                exitTime: new Date(),
                profitLoss: -50.0,
                channelId: channel2.id,
            },
        ],
        skipDuplicates: true,
    });

    // Seed Messages (author/channelId pairs must match TraderStats)
    await prisma.message.createMany({
        data: [
            {
                id: 'msg-1',
                channelId: channel1.id,
                discordId: 'discord-1',
                author: 'TraderJoe',
                content: 'Buy AAPL now!',
                type: 'TRADE',
                createdAt: new Date(),
            },
            {
                id: 'msg-2',
                channelId: channel2.id,
                discordId: 'discord-2',
                author: 'TraderJane',
                content: 'Sell TSLA now!',
                type: 'TRADE',
                createdAt: new Date(),
            },
        ],
        skipDuplicates: true,
    });

    // Seed MarketUpdate
    await prisma.marketUpdate.createMany({
        data: [
            {
                id: 'mu-1',
                channelId: channel1.id,
                messageId: 'msg-1',
                summary: 'AAPL surges after earnings',
                sentiment: 'BULLISH',
                symbol: 'AAPL',
                createdAt: new Date(),
            },
        ],
        skipDuplicates: true,
    });

    // Seed MarketCalendar
    await prisma.marketCalendar.create({
        data: {
            id: 'mc-1',
            eventDate: new Date(),
            title: 'Fed Meeting',
            source: 'Bloomberg',
            createdAt: new Date(),
        },
        skipDuplicates: true,
    }).catch(() => { });

    // Seed ModelLog
    await prisma.modelLog.create({
        data: {
            id: 'mlog-1',
            messageId: 'msg-1',
            prompt: 'What is the outlook for AAPL?',
            response: 'Positive',
            inputTokens: 10,
            outputTokens: 5,
            latencyMs: 100,
            modelName: 'mistral-7b',
            createdAt: new Date(),
        },
    }).catch(() => { });

    // Seed ManualLabel
    await prisma.manualLabel.create({
        data: {
            id: 'mlabel-1',
            messageId: 'msg-1',
            label: 'Buy',
            source: 'admin',
            confidence: 0.9,
            labeledAt: new Date(),
        },
    }).catch(() => { });

    // Seed TradeSignal
    await prisma.tradeSignal.create({
        data: {
            id: 'ts-1',
            tradeId: 'trade-1',
            confidence: 0.95,
            triggeredAt: new Date(),
            source: 'AI',
            autoExecuted: true,
            createdAt: new Date(),
        },
    }).catch(() => { });

    // Seed ExecutionStats
    await prisma.executionStats.create({
        data: {
            id: 'es-1',
            tradeId: 'trade-1',
            executedAt: new Date(),
            executedPrice: 150.0,
            exitPrice: 155.0,
            exitConfidence: 0.9,
            result: 'WIN',
            pnl: 50.0,
            durationSec: 3600,
            createdAt: new Date(),
        },
    }).catch(() => { });

    // Seed PerformanceHistory
    await prisma.performanceHistory.create({
        data: {
            id: 'ph-1',
            channelId: channel1.id,
            period: 'DAILY',
            startDate: new Date(),
            endDate: new Date(),
            totalTrades: 5,
            winRate: 0.6,
            avgProfit: 100.0,
            performance: 0.7,
            createdAt: new Date(),
        },
    }).catch(() => { });

    // Seed OrderRecord
    await prisma.orderRecord.create({
        data: {
            id: 'or-1',
            brokerOrderId: 'broker-1',
            symbol: 'AAPL',
            type: 'LIMIT',
            side: 'BUY',
            quantity: 10,
            price: 150.0,
            status: 'FILLED',
            filledAt: new Date(),
            createdAt: new Date(),
        },
    }).catch(() => { });

    // Seed ChannelConfig
    await prisma.channelConfig.create({
        data: {
            id: 'cc-1',
            channelId: channel1.id,
            isEnabled: true,
            minConfidence: 0.8,
            maxTrades: 10,
            riskLevel: 'HIGH',
            updatedAt: new Date(),
        },
    }).catch(() => { });

    // Seed BotStats
    await prisma.botStats.create({
        data: {
            id: 'bs-1',
            period: 'DAILY',
            startDate: new Date(),
            endDate: new Date(),
            totalTrades: 10,
            successfulTrades: 7,
            totalProfitLoss: 500.0,
            avgProfitLoss: 50.0,
            winRate: 0.7,
            avgConfidence: 0.8,
            avgTradeDuration: 3600,
            profitFactor: 1.5,
            expectancy: 0.6,
            maxConsecutiveWins: 3,
            maxConsecutiveLosses: 2,
            avgWinAmount: 80.0,
            avgLossAmount: -40.0,
            largestWin: 120.0,
            largestLoss: -60.0,
            bestTradingHour: 10,
            worstTradingHour: 15,
            bestTradingDay: 2,
            worstTradingDay: 4,
            avgTradesPerDay: 5.0,
            busiestTradingDay: new Date(),
            optionsRatio: 0.2,
            stockRatio: 0.7,
            cryptoRatio: 0.1,
            optionsWinRate: 0.5,
            stockWinRate: 0.8,
            cryptoWinRate: 0.3,
        },
    }).catch(() => { });

    console.log('Database seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 