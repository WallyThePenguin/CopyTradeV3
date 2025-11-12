import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../utils/logger.js';
import { validateApiKey } from '../../middleware/auth.js';
import { getStartDate } from '../../utils/dateUtils.js';
import { calculatePerformance, computeAdvancedMetrics } from '../../utils/calculationUtils.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route GET /api/v1/stats
 * @desc Get general statistics
 * @access Private
 */
router.get('/', validateApiKey, async (req, res) => {
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

/**
 * @route GET /api/v1/stats/performance
 * @desc Get performance data
 * @access Public
 */
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

/**
 * @route GET /api/v1/stats/trader
 * @desc Get trader statistics
 * @access Public
 */
router.get('/trader', async (req, res) => {
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

/**
 * @route GET /api/v1/stats/trader/:traderId/assets
 * @desc Get per-trader asset stats
 * @access Public
 */
router.get('/trader/:traderId/assets', async (req, res) => {
    try {
        const { traderId } = req.params;
        const { timeframe = '30d' } = req.query;
        const startDate = getStartDate(timeframe);
        
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

/**
 * @route GET /api/v1/stats/advanced
 * @desc Get advanced analytics for all trades
 * @access Public
 */
router.get('/advanced', async (req, res) => {
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

/**
 * @route GET /api/v1/stats/trader/:id/advanced
 * @desc Get advanced analytics for a specific trader
 * @access Public
 */
router.get('/trader/:id/advanced', async (req, res) => {
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

export default router;