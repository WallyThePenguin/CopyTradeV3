import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const prisma = new PrismaClient();

export async function checkDataQuality() {
    const issues = [];

    const badEntry = await prisma.trade.count({ where: { entryPrice: { lte: 0 } } });
    if (badEntry) issues.push(`${badEntry} trades have entryPrice <= 0`);

    const closedMissingExit = await prisma.trade.count({
        where: {
            status: 'CLOSED',
            OR: [ { exitPrice: null }, { exitPrice: 0 } ]
        }
    });
    if (closedMissingExit) issues.push(`${closedMissingExit} closed trades missing exitPrice`);

    const invalidOptionType = await prisma.trade.count({
        where: {
            optionType: { notIn: ['CALL', 'PUT', null] }
        }
    });
    if (invalidOptionType) issues.push(`${invalidOptionType} trades with invalid optionType`);

    const invalidStatus = await prisma.trade.count({
        where: { status: { notIn: ['OPEN', 'CLOSED'] } }
    });
    if (invalidStatus) issues.push(`${invalidStatus} trades with invalid status`);

    const zeroQuantity = await prisma.trade.count({ where: { quantity: { lte: 0 } } });
    if (zeroQuantity) issues.push(`${zeroQuantity} trades have quantity <= 0`);

    const messagesNoAuthor = await prisma.message.count({
        where: {
            OR: [ { author: null }, { author: '' } ]
        }
    });
    if (messagesNoAuthor) issues.push(`${messagesNoAuthor} messages missing author`);

    if (issues.length === 0) {
        issues.push('No data quality issues found');
    }

    await prisma.$disconnect();
    return issues;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    checkDataQuality()
        .then((issues) => {
            logger.info('Data Quality Report:');
            for (const issue of issues) {
                logger.info(` - ${issue}`);
            }
        })
        .catch((error) => {
            logger.error('Failed to run data quality check', error);
            process.exit(1);
        });
}
