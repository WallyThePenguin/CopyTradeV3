import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../utils/logger.js';
import { validateApiKey } from '../../middleware/auth.js';
import { getStartDate } from '../../utils/dateUtils.js';
import { calculatePerformance } from '../../utils/calculationUtils.js';
import { broadcastTradeUpdate } from '../../broadcast.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route GET /api/v1/trades
 * @desc Get trade history with pagination and filtering
 * @access Public
 */
router.get('/', async (req, res) => {
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
        const mappedTrades = trades.map(trade => ({
            tradeId: trade.id,
            channelId: trade.channelId,
            channelName: trade.channel.name,
            symbol: trade.symbol,
            entryTime: trade.entryTime,
            exitTime: trade.exitTime,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            returnPct: trade.profitLoss ? (trade.profitLoss / (trade.entryPrice * trade.quantity)) * 100 : 0,
            durationSec: trade.executionStats?.durationSec
        }));

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

/**
 * @route GET /api/v1/trades/feed
 * @desc Live trade feed endpoint
 * @access Public
 */
router.get('/feed', async (req, res) => {
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

export default router;