import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../utils/logger.js';
import { getStartDate } from '../../utils/dateUtils.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route GET /api/v1/charts/pl
 * @desc Get chart data for P/L
 * @access Public
 */
router.get('/pl', async (req, res) => {
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

/**
 * @route GET /api/v1/charts/winrate
 * @desc Get chart data for win rate
 * @access Public
 */
router.get('/winrate', async (req, res) => {
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

/**
 * @route GET /api/v1/charts/volume
 * @desc Get chart data for volume
 * @access Public
 */
router.get('/volume', async (req, res) => {
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

/**
 * @route GET /api/v1/charts/assets
 * @desc Get asset statistics
 * @access Public
 */
router.get('/assets', async (req, res) => {
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

export default router;