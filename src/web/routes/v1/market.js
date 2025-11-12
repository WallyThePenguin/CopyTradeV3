import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route GET /api/v1/market/updates
 * @desc Get market updates
 * @access Public
 */
router.get('/updates', async (req, res) => {
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

/**
 * @route GET /api/v1/market/orders
 * @desc Get all order records
 * @access Public
 */
router.get('/orders', async (req, res) => {
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

/**
 * @route GET /api/v1/market/bot-stats
 * @desc Get bot stats
 * @access Public
 */
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

export default router;