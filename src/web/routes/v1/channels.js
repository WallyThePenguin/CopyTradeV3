import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../utils/logger.js';
import { validateApiKey } from '../../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route GET /api/v1/channels
 * @desc Get all channels
 * @access Public
 */
router.get('/', async (req, res) => {
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

/**
 * @route GET /api/v1/channels/:id
 * @desc Get channel details
 * @access Private
 */
router.get('/:id', validateApiKey, async (req, res) => {
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

/**
 * @route PATCH /api/v1/channels/:id/mode
 * @desc Update channel mode
 * @access Private
 */
router.patch('/:id/mode', async (req, res) => {
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

/**
 * @route PATCH /api/v1/channels/:id/auto-copy
 * @desc Update auto-copy setting
 * @access Private
 */
router.patch('/:id/auto-copy', async (req, res) => {
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

export default router;