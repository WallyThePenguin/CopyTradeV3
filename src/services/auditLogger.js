import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export async function logExecution({ tradeId, channelId, type, statusCode = null, rawResponse = {}, durationMs = null }) {
    try {
        await prisma.executionAuditLog.create({
            data: { tradeId, channelId, type, statusCode, rawResponse, durationMs }
        });
    } catch (error) {
        logger.error('Failed to log execution audit', error);
    }
}

export async function startJob(jobName) {
    return prisma.jobLog.create({ data: { jobName, status: 'IN_PROGRESS' } });
}

export async function finishJob(jobId, status = 'SUCCESS', errorText = null) {
    await prisma.jobLog.update({
        where: { id: jobId },
        data: { status, endedAt: new Date(), errorText }
    });
}

