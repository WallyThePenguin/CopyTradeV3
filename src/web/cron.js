import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { broadcastSignal } from './websocket.js';

const prisma = new PrismaClient();

// Initialize cron jobs
export function setupCronJobs() {
    // Daily data quality check at 00:00 UTC
    cron.schedule('0 0 * * *', async () => {
        try {
            await checkDataQuality();
        } catch (error) {
            logger.error('Error in daily data quality check:', error);
        }
    });

    // Hourly performance check
    cron.schedule('0 * * * *', async () => {
        try {
            await checkPerformance();
        } catch (error) {
            logger.error('Error in hourly performance check:', error);
        }
    });

    // Weekly cleanup job on Sunday at 01:00 UTC
    cron.schedule('0 1 * * 0', async () => {
        try {
            await cleanupOldData();
        } catch (error) {
            logger.error('Error in weekly cleanup:', error);
        }
    });
}

// Check data quality
async function checkDataQuality() {
    logger.info('Starting daily data quality check');

    // Check for missing data
    const missingData = await prisma.trade.findMany({
        where: {
            OR: [
                { entryPrice: null },
                { exitPrice: null },
                { profitLoss: null }
            ]
        }
    });

    if (missingData.length > 0) {
        logger.warn(`Found ${missingData.length} trades with missing data`);
        // Notify admin or trigger data recovery process
    }

    // Check for data consistency
    const inconsistentData = await prisma.trade.findMany({
        where: {
            status: 'SUCCESS',
            profitLoss: { lt: 0 }
        }
    });

    if (inconsistentData.length > 0) {
        logger.warn(`Found ${inconsistentData.length} successful trades with negative profit`);
        // Flag for review
    }

    logger.info('Daily data quality check completed');
}

// Check performance metrics
async function checkPerformance() {
    logger.info('Starting hourly performance check');

    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [
        trades,
        successfulTrades,
        totalProfit
    ] = await Promise.all([
        prisma.trade.count({
            where: { createdAt: { gte: lastHour } }
        }),
        prisma.trade.count({
            where: {
                createdAt: { gte: lastHour },
                status: 'SUCCESS'
            }
        }),
        prisma.trade.aggregate({
            where: {
                createdAt: { gte: lastHour },
                status: 'SUCCESS'
            },
            _sum: { profitLoss: true }
        })
    ]);

    const performance = {
        trades,
        successfulTrades,
        totalProfit: totalProfit._sum.profitLoss || 0,
        successRate: trades > 0 ? (successfulTrades / trades) * 100 : 0
    };

    // Broadcast performance update
    broadcastSignal({
        type: 'performance_update',
        data: performance
    });

    logger.info('Hourly performance check completed', performance);
}

// Clean up old data
async function cleanupOldData() {
    logger.info('Starting weekly data cleanup');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Archive old trades
    const oldTrades = await prisma.trade.findMany({
        where: {
            createdAt: { lt: thirtyDaysAgo },
            status: { in: ['SUCCESS', 'FAILED'] }
        }
    });

    if (oldTrades.length > 0) {
        // Archive trades to a separate table or file
        // This is a placeholder for the actual archiving logic
        logger.info(`Archiving ${oldTrades.length} old trades`);
    }

    // Clean up temporary data
    await prisma.tempData.deleteMany({
        where: {
            createdAt: { lt: thirtyDaysAgo }
        }
    });

    logger.info('Weekly data cleanup completed');
} 