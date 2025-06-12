import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import tradingService from '../services/tradingService.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cron from 'node-cron';
import { checkDataQuality } from '../utils/dataQuality.js';
import { logger } from '../utils/logger.js';
import { validateEnv } from '../utils/validateEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!validateEnv()) {
    process.exit(1);
}

const app = express();
const prisma = new PrismaClient();
const port = process.env.WEB_PORT || 3000;

// Initialize trading service once on startup so broker sessions are ready
try {
    await tradingService.initialize();
    console.log('Trading service initialized');
} catch (err) {
    console.error('Failed to initialize trading service:', err);
}

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
    server,
    path: '/ws/signals'
});

// Store connected WebSocket clients
const wsClients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    wsClients.add(ws);

    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
    });
});

// Function to broadcast signals to all connected clients
export function broadcastSignal(signal) {
    const message = JSON.stringify(signal);
    wsClients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}

// Daily data quality check
const cronSpec = process.env.DATA_QUALITY_SCHEDULE || '0 4 * * *'; // 04:00 UTC
cron.schedule(cronSpec, async () => {
    try {
        const issues = await checkDataQuality();
        await logger.info('Daily data quality check', { issues });
    } catch (err) {
        await logger.error('Failed daily data quality check', err);
    }
});

// Middleware
app.use(express.json());

// Simple API key authentication for write operations
const API_KEY = process.env.API_KEY;
function authenticateWrite(req, res, next) {
    if (!API_KEY || !['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
    const key = req.headers['x-api-key'];
    if (key && key === API_KEY) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}
app.use(authenticateWrite);

// Add CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/stats', async (req, res) => {
    try {
        const period = req.query.period || 'DAILY';
        const mode = req.query.mode || 'ALL';
        const channelId = req.query.channel || null;
        const stats = await getStats(period, mode, channelId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// New endpoint: Parse-only for dry run analysis
app.post('/api/parse-only', async (req, res) => {
    try {
        const { message } = req.body;
        const { mistralService } = await import('../services/mistral.js');
        const analysis = await mistralService.analyzeMessage(message);
        res.json({ analysis, processed: false });
    } catch (error) {
        console.error('Error in parse-only:', error);
        res.status(500).json({ error: 'Failed to parse message' });
    }
});

// New endpoint: Channel performance
app.get('/api/channels/:channelId/performance', async (req, res) => {
    try {
        const { channelId } = req.params;
        const performance = await getChannelPerformance(channelId);
        res.json(performance);
    } catch (error) {
        console.error('Error fetching channel performance:', error);
        res.status(500).json({ error: 'Failed to fetch channel performance' });
    }
});

// List available channels
app.get('/api/channels', async (req, res) => {
    try {
        const mode = req.query.mode || 'ALL';
        const where = mode === 'TEST'
            ? { enabled: false }
            : mode === 'PROD'
                ? { enabled: true }
                : {};
        const channels = await prisma.channel.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        res.json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// List recent trades with optional mode/channel filter
app.get('/api/trades', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const mode = req.query.mode || 'ALL';
        const channelId = req.query.channel || undefined;
        const modeFilter = mode === 'TEST'
            ? { channel: { enabled: false } }
            : mode === 'PROD'
                ? { channel: { enabled: true } }
                : {};

        const trades = await prisma.trade.findMany({
            where: {
                ...(channelId ? { channelId } : {}),
                ...modeFilter
            },
            include: {
                channel: true
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.json(trades);
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// New endpoint: System health
app.get('/api/health', async (req, res) => {
    try {
        const health = await getSystemHealth();
        res.json(health);
    } catch (error) {
        console.error('Error fetching system health:', error);
        res.status(500).json({ error: 'Failed to fetch system health' });
    }
});

// New endpoint: Get current account positions
app.get('/api/positions', async (req, res) => {
    try {
        await tradingService.initialize();
        const positions = await tradingService.getPositions();
        res.json(positions);
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});

// New endpoint: Order history
app.get('/api/order-history', async (req, res) => {
    try {
        await tradingService.initialize();
        const orders = await tradingService.getOrderHistory();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
});

// Historical price lookup
app.get('/api/historical-prices', async (req, res) => {
    try {
        const symbol = req.query.symbol;
        if (!symbol) return res.status(400).json({ error: 'symbol required' });
        const interval = req.query.interval || '5minute';
        const span = req.query.span || 'day';
        await tradingService.initialize();
        const data = await tradingService.getHistoricalPrices(symbol, interval, span);
        res.json(data);
    } catch (error) {
        console.error('Error fetching historical prices:', error);
        res.status(500).json({ error: 'Failed to fetch historical prices' });
    }
});

// Stored order records
app.get('/api/order-records', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const records = await prisma.orderRecord.findMany({
            orderBy: { filledAt: 'desc' },
            take: limit
        });
        res.json(records);
    } catch (error) {
        console.error('Error fetching order records:', error);
        res.status(500).json({ error: 'Failed to fetch order records' });
    }
});

// Run data quality checks
app.get('/api/data-quality', async (req, res) => {
    try {
        const { checkDataQuality } = await import('../utils/dataQuality.js');
        const issues = await checkDataQuality();
        res.json({ issues });
    } catch (error) {
        console.error('Error running data quality check:', error);
        res.status(500).json({ error: 'Failed to run data quality check' });
    }
});

// New endpoint: Trade signals history
app.get('/api/signals', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const signals = await getRecentSignals(limit);
        res.json(signals);
    } catch (error) {
        console.error('Error fetching signals:', error);
        res.status(500).json({ error: 'Failed to fetch signals' });
    }
});

// Expose additional data for remaining tables
app.get('/api/market-updates', async (req, res) => {
    try {
        const updates = await prisma.marketUpdate.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' }
        });
        res.json(updates);
    } catch (error) {
        console.error('Error fetching market updates:', error);
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});

// Create a new market update
app.post('/api/market-updates', async (req, res) => {
    try {
        const { channelId, messageId, summary, sentiment, symbol = null } = req.body;
        const update = await prisma.marketUpdate.create({
            data: { channelId, messageId, summary, sentiment, symbol }
        });
        res.json(update);
    } catch (error) {
        console.error('Error creating market update:', error);
        res.status(500).json({ error: 'Failed to create update' });
    }
});

// Refresh market news using the Python importer
app.post('/api/refresh-market-news', async (req, res) => {
    try {
        const { spawn } = await import('child_process');
        await new Promise((resolve, reject) => {
            const child = spawn('python', ['api/market_news.py']);
            child.on('error', reject);
            child.on('close', code => {
                code === 0 ? resolve() : reject(new Error(`exit code ${code}`));
            });
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error refreshing market news:', error);
        res.status(500).json({ error: 'Failed to refresh market news' });
    }
});

app.get('/api/manual-labels', async (req, res) => {
    try {
        const labels = await prisma.manualLabel.findMany({
            take: 20,
            orderBy: { labeledAt: 'desc' }
        });
        res.json(labels);
    } catch (error) {
        console.error('Error fetching manual labels:', error);
        res.status(500).json({ error: 'Failed to fetch labels' });
    }
});

// Manually label a message
app.post('/api/manual-labels', async (req, res) => {
    try {
        const { messageId, label, source = 'manual', confidence = 1 } = req.body;
        const manualLabel = await prisma.manualLabel.create({
            data: { messageId, label, source, confidence }
        });
        res.json(manualLabel);
    } catch (error) {
        console.error('Error creating manual label:', error);
        res.status(500).json({ error: 'Failed to create label' });
    }
});

app.get('/api/model-logs', async (req, res) => {
    try {
        const logs = await prisma.modelLog.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        console.error('Error fetching model logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/price-snapshots', async (req, res) => {
    try {
        const symbol = req.query.symbol;
        const where = symbol ? { symbol } : {};
        const snapshots = await prisma.priceSnapshot.findMany({
            where,
            take: 50,
            orderBy: { recordedAt: 'desc' }
        });
        res.json(snapshots);
    } catch (error) {
        console.error('Error fetching price snapshots:', error);
        res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
});

app.get('/api/market-calendar', async (req, res) => {
    try {
        const events = await prisma.marketCalendar.findMany({
            where: { eventDate: { gte: new Date() } },
            orderBy: { eventDate: 'asc' },
            take: 20
        });
        res.json(events);
    } catch (error) {
        console.error('Error fetching market calendar:', error);
        res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
});

app.get('/api/channel-config/:id', async (req, res) => {
    try {
        const config = await prisma.channelConfig.findUnique({
            where: { channelId: req.params.id }
        });
        res.json(config);
    } catch (error) {
        console.error('Error fetching channel config:', error);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

app.post('/api/channel-config', async (req, res) => {
    try {
        const { channelId, isEnabled = true, minConfidence = 0.7, maxTrades = 5, riskLevel = 'MEDIUM' } = req.body;
        const config = await prisma.channelConfig.upsert({
            where: { channelId },
            update: { isEnabled, minConfidence, maxTrades, riskLevel },
            create: { channelId, isEnabled, minConfidence, maxTrades, riskLevel }
        });
        res.json(config);
    } catch (error) {
        console.error('Error saving channel config:', error);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

app.get('/api/bot-stats', async (req, res) => {
    try {
        const period = req.query.period || 'DAILY';
        const timeFilter = getTimeFilter(period);
        const trades = await prisma.trade.findMany({ where: { createdAt: timeFilter, status: 'CLOSED' } });
        const total = trades.length;
        const wins = trades.filter(t => t.profitLoss > 0).length;
        const totalPL = trades.reduce((s, t) => s + (t.profitLoss || 0), 0);
        const stats = await prisma.botStats.upsert({
            where: { period },
            update: {
                startDate: timeFilter.gte || new Date(0),
                endDate: new Date(),
                totalTrades: total,
                successfulTrades: wins,
                totalProfitLoss: totalPL,
                winRate: total > 0 ? wins / total : 0
            },
            create: {
                period,
                startDate: timeFilter.gte || new Date(0),
                endDate: new Date(),
                totalTrades: total,
                successfulTrades: wins,
                totalProfitLoss: totalPL,
                winRate: total > 0 ? wins / total : 0
            }
        });
        res.json(stats);
    } catch (error) {
        console.error('Error fetching bot stats:', error);
        res.status(500).json({ error: 'Failed to fetch bot stats' });
    }
});

// Test endpoint - Create a test trade
app.post('/api/test/trade', async (req, res) => {
    try {
        const { symbol, action, optionType, strikePrice, entryPrice } = req.body;

        // Get a random channel for testing
        const channels = await prisma.channel.findMany({ take: 1 });
        if (channels.length === 0) {
            return res.status(400).json({ error: 'No channels found. Please initialize channels first.' });
        }

        const trade = await prisma.trade.create({
            data: {
                channel: { connect: { id: channels[0].id } },
                symbol: symbol || 'TEST',
                action: action || 'BUY',
                optionType: optionType || 'CALL',
                strikePrice: strikePrice || 100,
                entryPrice: entryPrice || 10,
                exitPrice: 0,
                quantity: 1,
                status: 'OPEN'
            },
            include: {
                channel: true
            }
        });

        // Broadcast the test signal
        broadcastSignal({
            symbol: trade.symbol,
            action: trade.action,
            optionType: trade.optionType,
            strikePrice: trade.strikePrice,
            entryPrice: trade.entryPrice,
            confidence: 0.95,
            signalType: 'ENTRY',
            trader: 'TEST_USER',
            channel: trade.channel.name,
            timestamp: new Date()
        });

        res.json({ success: true, trade });
    } catch (error) {
        console.error('Error creating test trade:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint - Close a trade
app.put('/api/test/trade/:id/close', async (req, res) => {
    try {
        const { id } = req.params;
        const { exitPrice } = req.body;

        const trade = await prisma.trade.update({
            where: { id },
            data: {
                exitPrice: exitPrice || 15,
                status: 'CLOSED',
                exitTime: new Date(),
                profitLoss: (exitPrice || 15) - 10 // Assuming entry was 10
            }
        });

        res.json({ success: true, trade });
    } catch (error) {
        console.error('Error closing test trade:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint - Get all channels
app.get('/api/test/channels', async (req, res) => {
    try {
        const channels = await prisma.channel.findMany({
            include: {
                _count: {
                    select: {
                        trades: true,
                        messages: true
                    }
                }
            }
        });
        res.json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get statistics based on time period and mode
async function getStats(period, mode, channelId) {
    const timeFilter = getTimeFilter(period);

    const modeFilter = mode === 'TEST' ? { channel: { enabled: false } } :
        mode === 'PROD' ? { channel: { enabled: true } } : {};

    // Get basic stats
    const [trades, channels, traders] = await Promise.all([
        getTradeStats(timeFilter, channelId, modeFilter),
        getChannelStats(timeFilter, channelId, modeFilter),
        getTraderStats(timeFilter, channelId, modeFilter)
    ]);

    // Get performance history
    const performanceHistory = await getPerformanceHistory(timeFilter, channelId, modeFilter);

    // Get asset class distribution
    const assetClassDistribution = await getAssetClassDistribution(timeFilter, channelId, modeFilter);

    // Get risk metrics
    const riskMetrics = await getRiskMetrics(timeFilter, channelId, modeFilter);

    // Get signal quality metrics
    const signalQuality = await getSignalQuality(timeFilter, channelId, modeFilter);

    // Get message counts over time
    const messageCountsOverTime = await getMessageCountsOverTime(timeFilter, channelId, modeFilter);

    // Get trades counts over time
    const tradesCountsOverTime = await getTradesCountsOverTime(timeFilter, channelId, modeFilter);

    return {
        ...trades,
        ...channels,
        ...traders,
        performanceHistory,
        assetClassDistribution,
        ...riskMetrics,
        ...signalQuality,
        messageCountsOverTime,
        tradesCountsOverTime,
        mode
    };
}

// Get time filter based on period
function getTimeFilter(period) {
    const now = new Date();
    switch (period) {
        case 'DAILY':
            return { gte: new Date(now.setDate(now.getDate() - 1)) };
        case 'WEEKLY':
            return { gte: new Date(now.setDate(now.getDate() - 7)) };
        case 'MONTHLY':
            return { gte: new Date(now.setMonth(now.getMonth() - 1)) };
        default:
            return {};
    }
}

// Get trade statistics
async function getTradeStats(timeFilter, channelId, modeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        }
    });

    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    const totalTrades = trades.length;
    const winningTrades = closedTrades.filter(t => t.profitLoss && t.profitLoss > 0).length;
    const totalPL = closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    let avgDuration = 0;
    if (closedTrades.length > 0) {
        const totalDuration = closedTrades.reduce((sum, t) => {
            if (t.exitTime && t.entryTime) {
                const duration = (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60); // in minutes
                return sum + duration;
            }
            return sum;
        }, 0);
        avgDuration = totalDuration / closedTrades.length;
    }

    return {
        totalTrades,
        winRate: closedTrades.length > 0 ? winningTrades / closedTrades.length : 0,
        totalPL,
        avgTradeDuration: avgDuration || 0,
        recentTrades: await getRecentTrades(10, channelId, modeFilter)
    };
}

// Get channel statistics
async function getChannelStats(timeFilter, channelId, modeFilter) {
    const channels = await prisma.channel.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { id: channelId } : {}),
            ...(modeFilter.channel || {})
        },
        include: {
            trades: true
        }
    });

    const activeChannels = channels.filter(c => c.enabled).length;
    const bestChannel = channels.reduce((best, current) => {
        const currentPL = current.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
        const bestPL = best.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
        return currentPL > bestPL ? current : best;
    }, channels[0]);

    return {
        activeChannels,
        totalChannels: channels.length,
        bestChannel: bestChannel ? bestChannel.name : 'N/A',
        channels: channels.map(c => ({
            name: c.name,
            type: c.type,
            enabled: c.enabled,
            totalTrades: c.trades.length,
            performance: c.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
        }))
    };
}

// Get trader statistics
async function getTraderStats(timeFilter, channelId, modeFilter) {
    const traders = await prisma.traderStats.findMany({
        where: {
            updatedAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            // TraderStats has no `enabled` field, filter via the related Channel
            ...(modeFilter.channel ? { channel: modeFilter.channel } : {})
        },
        include: {
            channel: true
        }
    });

    return {
        topTraders: traders
            .sort((a, b) => b.avgProfitLoss - a.avgProfitLoss)
            .slice(0, 5)
            .map(t => ({
                name: t.author,
                channel: t.channel.name,
                winRate: t.successfulSignals / (t.totalSignals || 1),
                totalTrades: t.totalSignals,
                pl: t.avgProfitLoss
            }))
    };
}

// Get performance history
async function getPerformanceHistory(timeFilter, channelId, modeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    let cumulativePL = 0;
    return trades.map(trade => {
        cumulativePL += (trade.profitLoss || 0);
        return {
            timestamp: trade.createdAt,
            cumulativePL
        };
    });
}

// Get asset class distribution
async function getAssetClassDistribution(timeFilter, channelId, modeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        }
    });

    const distribution = trades.reduce((acc, trade) => {
        const assetClass = trade.optionType ? 'Options' : 'Stocks';
        acc[assetClass] = (acc[assetClass] || 0) + 1;
        return acc;
    }, {});

    return distribution;
}

// Get risk metrics
async function getRiskMetrics(timeFilter, channelId, modeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        }
    });

    const returns = trades.map(t => t.profitLoss || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    const sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;
    const maxDrawdown = calculateMaxDrawdown(returns);
    const sortinoRatio = calculateSortinoRatio(returns);

    return {
        sharpeRatio,
        maxDrawdown,
        sortinoRatio
    };
}

// Get signal quality metrics
async function getSignalQuality(timeFilter, channelId, modeFilter) {
    // Get all signals in the time period
    const signals = await prisma.tradeSignal.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { trade: { channelId } } : {}),
            ...modeFilter
        },
        include: {
            trade: true
        }
    });

    const totalSignals = signals.length;
    const executedSignals = signals.filter(s => s.autoExecuted).length;

    // Calculate successful signals based on trades that were profitable
    const successfulSignals = signals.filter(s =>
        s.trade && s.trade.status === 'CLOSED' && s.trade.profitLoss > 0
    ).length;

    // Calculate average confidence
    const avgConfidence = totalSignals > 0
        ? signals.reduce((sum, s) => sum + s.confidence, 0) / totalSignals
        : 0;

    return {
        signalAccuracy: executedSignals > 0 ? successfulSignals / executedSignals : 0,
        avgConfidence: avgConfidence || 0,
        totalSignals: totalSignals,
        executedSignals: executedSignals
    };
}

// Get recent trades
async function getRecentTrades(limit, channelId, modeFilter) {
    return prisma.trade.findMany({
        orderBy: {
            createdAt: 'desc'
        },
        take: limit,
        where: {
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        },
        include: {
            channel: true
        }
    });
}

// Helper functions for risk metrics
function calculateMaxDrawdown(returns) {
    if (!returns || returns.length === 0) return 0;

    let peak = returns[0];
    let maxDrawdown = 0;

    for (const ret of returns) {
        if (ret > peak) {
            peak = ret;
        }
        const drawdown = peak !== 0 ? (peak - ret) / Math.abs(peak) : 0;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
}

function calculateSortinoRatio(returns) {
    if (!returns || returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);

    if (downsideReturns.length === 0) return avgReturn > 0 ? Infinity : 0;

    const downsideDeviation = Math.sqrt(
        downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length
    );

    return downsideDeviation !== 0 ? avgReturn / downsideDeviation : 0;
}

// Add a new function to get calls/messages over time
async function getMessageCountsOverTime(timeFilter, channelId, modeFilter) {
    // Assuming you have a Message model/table with createdAt
    const messages = await prisma.message.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
    // Group by day
    const countsByDay = {};
    messages.forEach(msg => {
        const day = msg.createdAt.toISOString().slice(0, 10);
        countsByDay[day] = (countsByDay[day] || 0) + 1;
    });
    return Object.entries(countsByDay).map(([date, count]) => ({ date, count }));
}

// Add a new function to get trades over time
async function getTradesCountsOverTime(timeFilter, channelId, modeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter,
            ...(channelId ? { channelId } : {}),
            ...modeFilter
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
    // Group by day
    const countsByDay = {};
    trades.forEach(trade => {
        const day = trade.createdAt.toISOString().slice(0, 10);
        countsByDay[day] = (countsByDay[day] || 0) + 1;
    });
    return Object.entries(countsByDay).map(([date, count]) => ({ date, count }));
}

// Get channel performance
async function getChannelPerformance(channelId) {
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
            trades: {
                orderBy: { createdAt: 'desc' },
                take: 100
            },
            performanceHistory: {
                orderBy: { createdAt: 'desc' },
                take: 30
            },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 100
            }
        }
    });

    if (!channel) {
        throw new Error('Channel not found');
    }

    const totalTrades = channel.trades.length;
    const winningTrades = channel.trades.filter(t => t.profitLoss > 0).length;
    const totalPL = channel.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    return {
        channel: {
            name: channel.name,
            type: channel.type,
            enabled: channel.enabled
        },
        performance: {
            totalTrades,
            winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
            totalPL,
            avgProfit: totalTrades > 0 ? totalPL / totalTrades : 0
        },
        recentActivity: {
            lastTrade: channel.trades[0],
            lastMessage: channel.messages[0],
            messagesPerDay: channel.messages.length / 30
        },
        history: channel.performanceHistory
    };
}

// Get system health
async function getSystemHealth() {
    const [tradeCount, messageCount, channelCount, errorCount] = await Promise.all([
        prisma.trade.count(),
        prisma.message.count(),
        prisma.channel.count({ where: { enabled: true } }),
        prisma.modelLog.count({ where: { response: { contains: 'error' } } })
    ]);

    const recentErrors = await prisma.modelLog.findMany({
        where: {
            response: { contains: 'error' },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    return {
        status: errorCount === 0 ? 'healthy' : 'degraded',
        metrics: {
            totalTrades: tradeCount,
            totalMessages: messageCount,
            activeChannels: channelCount,
            recentErrors: errorCount
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date(),
        recentErrors
    };
}

// Get recent signals
async function getRecentSignals(limit) {
    const signals = await prisma.tradeSignal.findMany({
        take: limit,
        orderBy: { triggeredAt: 'desc' },
        include: {
            trade: {
                include: {
                    channel: true
                }
            }
        }
    });

    return signals.map(signal => ({
        id: signal.id,
        symbol: signal.trade.symbol,
        action: signal.trade.action,
        confidence: signal.confidence,
        triggeredAt: signal.triggeredAt,
        channel: signal.trade.channel.name,
        executed: signal.autoExecuted,
        profitLoss: signal.trade.profitLoss
    }));
}

// Start server with WebSocket support
server.listen(port, () => {
    console.log(`Web UI server running at http://localhost:${port}`);
});

// Export the broadcast function for use in other modules
export { wsClients }; 