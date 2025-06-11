import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import robinhoodService from '../services/robinhood.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const port = process.env.WEB_PORT || 3000;

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

// Middleware
app.use(express.json());

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
        const stats = await getStats(period, mode);
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
async function getStats(period, mode) {
    const timeFilter = getTimeFilter(period);

    // Get basic stats
    const [trades, channels, traders] = await Promise.all([
        getTradeStats(timeFilter),
        getChannelStats(timeFilter),
        getTraderStats(timeFilter)
    ]);

    // Get performance history
    const performanceHistory = await getPerformanceHistory(timeFilter);

    // Get asset class distribution
    const assetClassDistribution = await getAssetClassDistribution(timeFilter);

    // Get risk metrics
    const riskMetrics = await getRiskMetrics(timeFilter);

    // Get signal quality metrics
    const signalQuality = await getSignalQuality(timeFilter);

    // Get message counts over time
    const messageCountsOverTime = await getMessageCountsOverTime(timeFilter);

    // Get trades counts over time
    const tradesCountsOverTime = await getTradesCountsOverTime(timeFilter);

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
async function getTradeStats(timeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter
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
        recentTrades: await getRecentTrades(10)
    };
}

// Get channel statistics
async function getChannelStats(timeFilter) {
    const channels = await prisma.channel.findMany({
        where: {
            createdAt: timeFilter
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
async function getTraderStats(timeFilter) {
    const traders = await prisma.traderStats.findMany({
        where: {
            updatedAt: timeFilter
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
async function getPerformanceHistory(timeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter
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
async function getAssetClassDistribution(timeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter
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
async function getRiskMetrics(timeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter
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
async function getSignalQuality(timeFilter) {
    // Get all signals in the time period
    const signals = await prisma.tradeSignal.findMany({
        where: {
            createdAt: timeFilter
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
async function getRecentTrades(limit) {
    return prisma.trade.findMany({
        orderBy: {
            createdAt: 'desc'
        },
        take: limit,
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
async function getMessageCountsOverTime(timeFilter) {
    // Assuming you have a Message model/table with createdAt
    const messages = await prisma.message.findMany({
        where: {
            createdAt: timeFilter
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
async function getTradesCountsOverTime(timeFilter) {
    const trades = await prisma.trade.findMany({
        where: {
            createdAt: timeFilter
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