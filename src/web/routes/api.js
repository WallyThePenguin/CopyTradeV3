import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { broadcastSignal } from '../websocket.js';
import { broadcastTradeUpdate, broadcastTradeSignal, broadcastChannelMetrics, broadcastPerformanceUpdate, broadcastMarketUpdate, broadcastTraderStats, broadcastBotStats } from '../broadcast.js';
import { validateApiKey, validateAdmin } from '../middleware/index.js';
import calloutService from '../../services/calloutService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to get start date based on timeframe
function getStartDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
        case '7d':
            return new Date(now.setDate(now.getDate() - 7));
        case '30d':
            return new Date(now.setDate(now.getDate() - 30));
        case 'ytd':
            return new Date(now.getFullYear(), 0, 1);
        case 'all':
            return new Date(0);
        default:
            return new Date(now.setDate(now.getDate() - 30));
    }
}

// Helper function to calculate performance metrics
function calculatePerformance(trades) {
    const totalTrades = trades.length;
    const successfulTrades = trades.filter(t => t.profitLoss > 0).length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const avgReturn = totalTrades > 0 ? totalProfit / totalTrades : 0;

    return {
        trades: totalTrades,
        successfulTrades,
        totalProfit,
        successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
        avgReturn,
        timestamp: new Date().toISOString()
    };
}

// Get statistics
router.get('/stats', validateApiKey, async (req, res) => {
    try {
        const [
            totalTrades,
            successfulTrades,
            totalProfit,
            activeChannels
        ] = await Promise.all([
            prisma.trade.count(),
            prisma.trade.count({ where: { status: 'SUCCESS' } }),
            prisma.trade.aggregate({
                where: { status: 'SUCCESS' },
                _sum: { profitLoss: true }
            }),
            prisma.channel.count({ where: { enabled: true } })
        ]);

        res.json({
            totalTrades,
            successfulTrades,
            totalProfit: totalProfit._sum.profitLoss || 0,
            activeChannels,
            successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0
        });
    } catch (error) {
        logger.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Callout endpoints
router.get('/callouts', async (req, res) => {
    try {
        const { limit = 100, status, symbol } = req.query;
        const callouts = await calloutService.listCallouts({
            limit: Number(limit),
            status,
            symbol
        });
        const mapped = callouts.map(c => ({
            id: c.id,
            symbol: c.symbol,
            action: c.action,
            optionType: c.optionType,
            strikePrice: c.strikePrice,
            expirationDate: c.expirationDate,
            targetEntry: c.targetEntry,
            targetExit: c.targetExit,
            status: c.status,
            confidence: c.confidence,
            channelId: c.channelId,
            channelName: c.channel?.name || c.channelName,
            traderName: c.traderName,
            calloutAt: c.calloutAt,
            matchedAt: c.matchedAt,
            tradeId: c.trade?.id || null,
            tradeStatus: c.trade?.status || null,
            matches: (c.matches || []).map(m => ({
                id: m.id,
                quoteSource: m.quoteSource,
                referencePrice: m.referencePrice,
                bidPrice: m.bidPrice,
                askPrice: m.askPrice,
                markPrice: m.markPrice,
                quoteTimestamp: m.quoteTimestamp
            }))
        }));
        res.json(mapped);
    } catch (error) {
        logger.error('Error fetching callouts:', error);
        res.status(500).json({ error: 'Failed to fetch callouts' });
    }
});

router.get('/callouts/:id', async (req, res) => {
    try {
        const callout = await calloutService.getCallout(req.params.id);
        if (!callout) {
            return res.status(404).json({ error: 'Callout not found' });
        }
        res.json(callout);
    } catch (error) {
        logger.error('Error fetching callout:', error);
        res.status(500).json({ error: 'Failed to fetch callout' });
    }
});

router.post('/callouts', validateApiKey, async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await calloutService.recordManualCallout(payload);
        res.status(201).json(result);
    } catch (error) {
        logger.error('Error recording manual callout:', error);
        res.status(400).json({ error: error.message || 'Failed to record callout' });
    }
});

// Paginated channels with stats
router.get('/channels', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const take = Math.max(1, Math.min(50, parseInt(limit)));
        const skip = (Math.max(1, parseInt(page)) - 1) * take;

        const [channels, total] = await Promise.all([
            prisma.channel.findMany({
                skip,
                take,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.channel.count()
        ]);

        const summaries = await Promise.all(channels.map(buildChannelSummary));

        res.json({
            channels: summaries,
            total,
            pages: Math.ceil(total / take),
            currentPage: Math.max(1, parseInt(page))
        });
    } catch (error) {
        logger.error('Error fetching channel list:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

router.get('/channels/:id/stats', async (req, res) => {
    try {
        const channel = await prisma.channel.findUnique({
            where: { id: req.params.id }
        });
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        const detail = await getChannelStats(channel.id);
        res.json({
            channel,
            ...detail
        });
    } catch (error) {
        logger.error('Error fetching channel stats:', error);
        res.status(500).json({ error: 'Failed to fetch channel stats' });
    }
});

// Paginated users (trader stats)
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const take = Math.max(1, Math.min(50, parseInt(limit)));
        const skip = (Math.max(1, parseInt(page)) - 1) * take;

        const [users, total] = await Promise.all([
            prisma.traderStats.findMany({
                skip,
                take,
                orderBy: { lastActive: 'desc' },
                include: { channel: true }
            }),
            prisma.traderStats.count()
        ]);

        const mapped = users.map(user => ({
            id: user.id,
            author: user.author,
            channelId: user.channelId,
            channelName: user.channel?.name || '',
            totalSignals: user.totalSignals,
            successfulSignals: user.successfulSignals,
            avgConfidence: user.avgConfidence,
            avgProfitLoss: user.avgProfitLoss,
            winRate: user.totalSignals ? (user.successfulSignals / user.totalSignals) * 100 : 0,
            lastActive: user.lastActive,
            bestSymbols: (() => {
                try {
                    return JSON.parse(user.bestSymbols || '[]');
                } catch {
                    return [];
                }
            })()
        }));

        res.json({
            users: mapped,
            total,
            pages: Math.ceil(total / take),
            currentPage: Math.max(1, parseInt(page))
        });
    } catch (error) {
        logger.error('Error fetching users list:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/users/:id/stats', async (req, res) => {
    try {
        const detail = await getUserDetail(req.params.id);
        if (!detail) {
            return res.status(404).json({ error: 'User stats not found' });
        }
        res.json(detail);
    } catch (error) {
        logger.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

// Get performance data
router.get('/performance', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);

        const trades = await prisma.trade.findMany({
            where: {
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'asc' }
        });

        const performance = calculatePerformance(trades);
        res.json(performance);
    } catch (error) {
        logger.error('Error fetching performance data:', error);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

// Get trade history with pagination and filtering
router.get('/trades', async (req, res) => {
    try {
        const { page = 1, limit = 50, status, channelId, timeframe } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (status) where.status = status;
        if (channelId) where.channelId = channelId;
        if (timeframe) {
            where.createdAt = { gte: getStartDate(timeframe) };
        }

        const [trades, total] = await Promise.all([
            prisma.trade.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    channel: true,
                    executionStats: true
                }
            }),
            prisma.trade.count({ where })
        ]);

        // Map to frontend format
        const mappedTrades = trades.map(trade => {
            const basis = trade.entryPrice && trade.quantity ? trade.entryPrice * trade.quantity : null;
            const returnPct =
                basis && typeof trade.profitLoss === 'number'
                    ? (trade.profitLoss / basis) * 100
                    : 0;
            return {
                tradeId: trade.id,
                channelId: trade.channelId,
                channelName: trade.channel.name,
                symbol: trade.symbol,
                optionType: trade.optionType,
                strikePrice: trade.strikePrice,
                expirationDate: trade.expirationDate,
                status: trade.status,
                mode: trade.mode,
                calloutId: trade.calloutId,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                returnPct,
                durationSec: trade.executionStats?.durationSec
            };
        });

        res.json({
            trades: mappedTrades,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        logger.error('Error fetching trade history:', error);
        res.status(500).json({ error: 'Failed to fetch trade history' });
    }
});

// Get channel details
router.get('/channels/:id', validateApiKey, async (req, res) => {
    try {
        const channel = await prisma.channel.findUnique({
            where: { id: req.params.id },
            include: {
                trades: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        res.json(channel);
    } catch (error) {
        logger.error('Error fetching channel details:', error);
        res.status(500).json({ error: 'Failed to fetch channel details' });
    }
});

// Update channel mode (PATCH)
router.patch('/channels/:id/mode', async (req, res) => {
    try {
        const { mode } = req.body;
        const channel = await prisma.channel.update({
            where: { id: req.params.id },
            data: { mode }
        });
        res.json(channel);
    } catch (error) {
        logger.error('Error updating channel mode:', error);
        res.status(500).json({ error: 'Failed to update mode' });
    }
});

// Update auto-copy (PATCH)
router.patch('/channels/:id/auto-copy', async (req, res) => {
    try {
        const { enabled } = req.body;
        const channel = await prisma.channel.update({
            where: { id: req.params.id },
            data: { enabled }
        });
        res.json(channel);
    } catch (error) {
        logger.error('Error updating auto-copy:', error);
        res.status(500).json({ error: 'Failed to update auto-copy' });
    }
});

// Get all channels
router.get('/channels', async (req, res) => {
    try {
        const channels = await prisma.channel.findMany({
            include: {
                traderStats: true,
                trades: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        // Map to frontend format
        const mappedChannels = channels.map(channel => ({
            channelId: channel.id,
            name: channel.name,
            autoCopy: channel.enabled,
            mode: channel.type === 'shortform' ? 'score' : 'manual',
            winRate: channel.winRate,
            avgReturn: channel.avgProfit,
            tradeCount: channel.totalTrades,
            score: channel.performance,
            active: channel.trades.some(t => t.status === 'OPEN')
        }));

        res.json(mappedChannels);
    } catch (error) {
        logger.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// Get all order records
router.get('/order-records', async (req, res) => {
    try {
        const orderRecords = await prisma.orderRecord.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(orderRecords);
    } catch (error) {
        logger.error('Error fetching order records:', error);
        res.status(500).json({ error: 'Failed to fetch order records' });
    }
});

// Get trader statistics
router.get('/trader-stats', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);

        const traders = await prisma.traderStats.findMany({
            where: {
                lastActive: { gte: startDate }
            },
            orderBy: { totalSignals: 'desc' }
        });

        res.json(traders);
    } catch (error) {
        logger.error('Error fetching trader statistics:', error);
        res.status(500).json({ error: 'Failed to fetch trader statistics' });
    }
});

// Get chart data for P/L
router.get('/charts/pl', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);

        const trades = await prisma.trade.findMany({
            where: {
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'asc' }
        });

        const chartData = trades.map(trade => ({
            date: trade.createdAt.toISOString().split('T')[0],
            profit: trade.profitLoss || 0
        }));

        res.json(chartData);
    } catch (error) {
        logger.error('Error fetching P/L chart data:', error);
        res.status(500).json({ error: 'Failed to fetch P/L chart data' });
    }
});

// Get chart data for win rate
router.get('/charts/winrate', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);

        const trades = await prisma.trade.findMany({
            where: {
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'asc' }
        });

        const chartData = trades.map(trade => ({
            date: trade.createdAt.toISOString().split('T')[0],
            winRate: trade.profitLoss > 0 ? 100 : 0
        }));

        res.json(chartData);
    } catch (error) {
        logger.error('Error fetching win rate chart data:', error);
        res.status(500).json({ error: 'Failed to fetch win rate chart data' });
    }
});

// Get chart data for volume
router.get('/charts/volume', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);

        const trades = await prisma.trade.findMany({
            where: {
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'asc' }
        });

        const chartData = trades.map(trade => ({
            date: trade.createdAt.toISOString().split('T')[0],
            trades: 1
        }));

        res.json(chartData);
    } catch (error) {
        logger.error('Error fetching volume chart data:', error);
        res.status(500).json({ error: 'Failed to fetch volume chart data' });
    }
});

// Get asset statistics
router.get('/charts/assets', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);

        const trades = await prisma.trade.findMany({
            where: {
                createdAt: { gte: startDate }
            }
        });

        const assetStats = trades.reduce((acc, trade) => {
            if (!acc[trade.symbol]) {
                acc[trade.symbol] = {
                    symbol: trade.symbol,
                    trades: 0,
                    winRate: 0,
                    avgReturn: 0,
                    totalGain: 0
                };
            }
            acc[trade.symbol].trades++;
            acc[trade.symbol].winRate += trade.profitLoss > 0 ? 1 : 0;
            acc[trade.symbol].totalGain += trade.profitLoss || 0;
            return acc;
        }, {});

        const stats = Object.values(assetStats).map(stat => ({
            ...stat,
            winRate: (stat.winRate / stat.trades) * 100,
            avgReturn: stat.totalGain / stat.trades
        }));

        res.json(stats);
    } catch (error) {
        logger.error('Error fetching asset statistics:', error);
        res.status(500).json({ error: 'Failed to fetch asset statistics' });
    }
});

// Get market updates
router.get('/market-updates', async (req, res) => {
    try {
        const updates = await prisma.marketUpdate.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(updates);
    } catch (error) {
        logger.error('Error fetching market updates:', error);
        res.status(500).json({ error: 'Failed to fetch market updates' });
    }
});

// Get bot stats
router.get('/bot-stats', async (req, res) => {
    try {
        const stats = await prisma.botStats.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching bot stats:', error);
        res.status(500).json({ error: 'Failed to fetch bot stats' });
    }
});

// Live trade feed endpoint
router.get('/trades/feed', async (req, res) => {
    try {
        const trades = await prisma.trade.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { channel: true }
        });
        const feed = trades.map(trade => ({
            id: trade.id,
            symbol: trade.symbol,
            action: trade.action,
            trader: trade.author || (trade.channel ? trade.channel.name : 'Unknown'),
            profitLoss: trade.profitLoss || 0,
            time: trade.exitTime || trade.createdAt
        }));
        res.json(feed);
    } catch (error) {
        logger.error('Error fetching live trade feed:', error);
        res.status(500).json({ error: 'Failed to fetch live feed' });
    }
});

// Per-trader asset stats endpoint
router.get('/trader-assets/:traderId', async (req, res) => {
    try {
        const { traderId } = req.params;
        const { timeframe = '30d' } = req.query;
        let startDate;
        if (timeframe === '7d') startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        else if (timeframe === '30d') startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        else if (timeframe === 'ytd') startDate = new Date(new Date().getFullYear(), 0, 1);
        // else all time
        const where = { author: traderId };
        if (startDate) where['createdAt'] = { gte: startDate };
        const trades = await prisma.trade.findMany({ where });
        const bySymbol = {};
        trades.forEach(trade => {
            if (!bySymbol[trade.symbol]) bySymbol[trade.symbol] = [];
            bySymbol[trade.symbol].push(trade);
        });
        const stats = Object.entries(bySymbol).map(([symbol, trades]) => {
            const wins = trades.filter(t => t.profitLoss > 0).length;
            const total = trades.length;
            const winRate = total > 0 ? wins / total : 0;
            const avgReturn = total > 0 ? trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / total : 0;
            const totalGain = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
            return { symbol, trades: total, winRate, avgReturn, totalGain };
        });
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching trader asset stats:', error);
        res.status(500).json({ error: 'Failed to fetch trader asset stats' });
    }
});

// Advanced analytics for all trades
router.get('/advanced-metrics', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);
        const trades = await prisma.trade.findMany({
            where: { createdAt: { gte: startDate } },
            orderBy: { createdAt: 'asc' }
        });
        return res.json(computeAdvancedMetrics(trades));
    } catch (error) {
        logger.error('Error fetching advanced metrics:', error);
        res.status(500).json({ error: 'Failed to fetch advanced metrics' });
    }
});

// Advanced analytics for a specific trader
router.get('/trader-advanced-metrics/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);
        const trades = await prisma.trade.findMany({
            where: { author: id, createdAt: { gte: startDate } },
            orderBy: { createdAt: 'asc' }
        });
        return res.json(computeAdvancedMetrics(trades));
    } catch (error) {
        logger.error('Error fetching trader advanced metrics:', error);
        res.status(500).json({ error: 'Failed to fetch trader advanced metrics' });
    }
});

// Helper to compute advanced metrics
function computeAdvancedMetrics(trades) {
    if (!trades || trades.length === 0) return {};
    const returns = trades.map(t => t.profitLoss || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev ? avgReturn / stdDev : 0;
    // Max Drawdown
    let maxDrawdown = 0, peak = 0, trough = 0, runningMax = 0;
    let equity = 0;
    for (const r of returns) {
        equity += r;
        if (equity > runningMax) runningMax = equity;
        const drawdown = runningMax - equity;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            peak = runningMax;
            trough = equity;
        }
    }
    // Profit Factor
    const grossProfit = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss ? grossProfit / grossLoss : 0;
    // Expectancy
    const winCount = returns.filter(r => r > 0).length;
    const lossCount = returns.filter(r => r < 0).length;
    const expectancy = returns.length > 0 ? (grossProfit - grossLoss) / returns.length : 0;
    // Avg Holding Time
    const holdingTimes = trades.map(t => t.exitTime && t.entryTime ? (new Date(t.exitTime) - new Date(t.entryTime)) / 1000 : 0).filter(x => x > 0);
    const avgHoldingTime = holdingTimes.length > 0 ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0;
    // Win/Loss Streaks
    let winStreak = 0, maxWinStreak = 0, lossStreak = 0, maxLossStreak = 0;
    for (const r of returns) {
        if (r > 0) {
            winStreak++;
            maxWinStreak = Math.max(maxWinStreak, winStreak);
            lossStreak = 0;
        } else if (r < 0) {
            lossStreak++;
            maxLossStreak = Math.max(maxLossStreak, lossStreak);
            winStreak = 0;
        } else {
            winStreak = 0;
            lossStreak = 0;
        }
    }
    // Monthly/Weekly Performance
    const monthly = {};
    const weekly = {};
    trades.forEach(t => {
        const d = new Date(t.exitTime || t.createdAt);
        const month = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const week = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 6 - d.getDay()) / 7)}`;
        monthly[month] = (monthly[month] || 0) + (t.profitLoss || 0);
        weekly[week] = (weekly[week] || 0) + (t.profitLoss || 0);
    });
    // Volatility
    const volatility = stdDev;
    // Return Distribution (histogram)
    const bins = Array(11).fill(0);
    returns.forEach(r => {
        const idx = Math.max(0, Math.min(10, Math.floor((r + 1) * 5)));
        bins[idx]++;
    });
    // Trade Type Breakdown (buy/sell)
    const tradeTypeBreakdown = trades.reduce((acc, t) => {
        const type = t.action || 'UNKNOWN';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    return {
        sharpeRatio,
        maxDrawdown,
        profitFactor,
        expectancy,
        avgHoldingTime,
        winStreak: maxWinStreak,
        lossStreak: maxLossStreak,
        monthlyPerformance: monthly,
        weeklyPerformance: weekly,
        volatility,
        returnDistribution: bins,
        tradeTypeBreakdown
    };
}

// After any trade creation or closure (e.g., in POST /trades, PATCH /trades/:id/close, etc):
// await broadcastLiveFeed(prisma);

export default router; 
async function buildChannelSummary(channel) {
    const stats = await prisma.trade.aggregate({
        where: { channelId: channel.id },
        _count: { _all: true },
        _sum: { profitLoss: true },
        _max: { createdAt: true }
    });

    const winning = await prisma.trade.count({
        where: { channelId: channel.id, profitLoss: { gt: 0 } }
    });

    const totalTrades = stats._count?._all || 0;
    const totalProfit = stats._sum?.profitLoss || 0;
    const winRate = totalTrades > 0 ? (winning / totalTrades) * 100 : 0;

    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        mode: channel.mode,
        enabled: channel.enabled,
        totalTrades,
        winRate,
        totalProfit,
        lastTradeAt: stats._max?.createdAt || null
    };
}

async function getChannelStats(channelId) {
    const [aggregate, winning, losing, bestTrade, worstTrade, recentTrades, leaderBoard] = await Promise.all([
        prisma.trade.aggregate({
            where: { channelId },
            _count: { _all: true },
            _sum: { profitLoss: true },
            _avg: { profitLoss: true },
            _max: { createdAt: true }
        }),
        prisma.trade.count({
            where: { channelId, profitLoss: { gt: 0 } }
        }),
        prisma.trade.count({
            where: { channelId, profitLoss: { lt: 0 } }
        }),
        prisma.trade.findFirst({
            where: { channelId },
            orderBy: { profitLoss: 'desc' },
            take: 1
        }),
        prisma.trade.findFirst({
            where: { channelId },
            orderBy: { profitLoss: 'asc' },
            take: 1
        }),
        prisma.trade.findMany({
            where: { channelId },
            orderBy: { createdAt: 'desc' },
            take: 10
        }),
        prisma.traderStats.findMany({
            where: { channelId },
            orderBy: { totalSignals: 'desc' },
            take: 5,
            include: { channel: true }
        })
    ]);

    const totalTrades = aggregate._count?._all || 0;
    const totalProfit = aggregate._sum?.profitLoss || 0;
    const winRate = totalTrades > 0 ? (winning / totalTrades) * 100 : 0;
    const lossRate = totalTrades > 0 ? (losing / totalTrades) * 100 : 0;

    return {
        stats: {
            totalTrades,
            totalProfit,
            avgProfit: aggregate._avg?.profitLoss || 0,
            winRate,
            lossRate,
            lastTradeAt: aggregate._max?.createdAt || null,
            bestTrade,
            worstTrade
        },
        recentTrades,
        leaderBoard: leaderBoard.map(trader => ({
            id: trader.id,
            author: trader.author,
            channelId: trader.channelId,
            channelName: trader.channel?.name || '',
            totalSignals: trader.totalSignals,
            winRate: trader.totalSignals ? (trader.successfulSignals / trader.totalSignals) * 100 : 0,
            avgProfitLoss: trader.avgProfitLoss
        }))
    };
}

async function getUserDetail(traderStatsId) {
    const record = await prisma.traderStats.findUnique({
        where: { id: traderStatsId },
        include: { channel: true }
    });
    if (!record) return null;

    const recentTrades = await prisma.trade.findMany({
        where: {
            channelId: record.channelId,
            author: record.author
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    const totalWins = await prisma.trade.count({
        where: {
            channelId: record.channelId,
            author: record.author,
            profitLoss: { gt: 0 }
        }
    });
    const totalTrades = await prisma.trade.count({
        where: {
            channelId: record.channelId,
            author: record.author
        }
    });

    let parsedSymbols = [];
    try {
        parsedSymbols = JSON.parse(record.bestSymbols || '[]');
    } catch {
        parsedSymbols = [];
    }

    return {
        user: {
            ...record,
            bestSymbols: parsedSymbols
        },
        winRate: totalTrades ? (totalWins / totalTrades) * 100 : 0,
        recentTrades
    };
}
