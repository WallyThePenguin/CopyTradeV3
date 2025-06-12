import { PrismaClient } from '@prisma/client';
import { channels as channelConfig } from '../config/channels.js';

const prisma = new PrismaClient();

export async function initializeDatabase() {
    try {
        logger.info('Initializing database...');

        // Ensure all channels from config exist in the database
        const allChannels = [...channelConfig.shortform, ...channelConfig.longform];

        for (const channel of allChannels) {
            await prisma.channel.upsert({
                where: { id: channel.id },
                update: {
                    name: channel.name,
                    type: channel.type,
                    enabled: true,
                    minConfidence: channel.minConfidence || 0.8,
                    maxTrades: channel.maxTrades || 5,
                    riskLevel: channel.riskLevel || 'MEDIUM',
                    webhook_url: channel.webhook_url
                },
                create: {
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    enabled: true,
                    minConfidence: channel.minConfidence || 0.8,
                    maxTrades: channel.maxTrades || 5,
                    riskLevel: channel.riskLevel || 'MEDIUM',
                    webhook_url: channel.webhook_url
                }
            });
        }

        logger.info('Channels inserted/verified in database');

        // Initialize trader stats for known traders if needed
        // This is optional but can help with initial setup

    } catch (error) {
        logger.error('Error initializing database:', error);
        throw error;
    }
}

export async function cleanupOldData(daysToKeep = 30) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        // Clean up old messages
        const deletedMessages = await prisma.message.deleteMany({
            where: {
                createdAt: { lt: cutoffDate }
            }
        });

        // Clean up old closed trades
        const deletedTrades = await prisma.trade.deleteMany({
            where: {
                AND: [
                    { status: 'CLOSED' },
                    { createdAt: { lt: cutoffDate } }
                ]
            }
        });

        logger.info(`Cleaned up ${deletedMessages.count} old messages and ${deletedTrades.count} old trades`);

    } catch (error) {
        logger.error('Error cleaning up old data:', error);
    }
}

export default { initializeDatabase, cleanupOldData };