import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import tradingService from './tradingService.js';
import robinhoodSimulator from './robinhoodSimulator.js';

class TradeTracker {
    constructor() {
        this.prisma = prisma;
    }

    async trackTrade(tradeData) {
    try {
        const {
            channelId,
            channelName = 'Unknown',
            channelType = 'UNKNOWN',
            symbol,
            action,
            optionType,
            strikePrice,
            quantity = 1,
            signalType = 'ENTRY', // ← new
            entryPrice = null      // ← new (can override simulator price if known)
        } = tradeData;

        // 🔄 Ensure the channel exists and check if it's disabled
        const channel = await this.prisma.channel.upsert({
            where: { id: channelId },
            update: {},
            create: {
                id: channelId,
                name: channelName,
                type: channelType
            }
        });

        const isSimulated = !channel.enabled;

        // EXIT TRACKING MODE
        if (signalType === 'EXIT') {
            const openTrade = await this.prisma.trade.findFirst({
                where: {
                    symbol,
                    optionType,
                    strikePrice,
                    channelId,
                    status: 'OPEN'
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!openTrade) {
                console.warn('No open trade to close for:', { symbol, optionType, strikePrice });
                return null;
            }

            // Simulate price if not explicitly passed
            const exitPrice = entryPrice ?? await tradingService.getExitPrice(
    symbol,
    strikePrice,
    optionType,
    openTrade.expirationDate,
    openTrade.entryPrice
);

            const pnl = optionType === 'PUT'
                ? (openTrade.entryPrice - exitPrice) * quantity * 100
                : (exitPrice - openTrade.entryPrice) * quantity * 100;

            const updated = await this.prisma.trade.update({
                where: { id: openTrade.id },
                data: {
                    status: 'CLOSED',
                    exitPrice,
                    profitLoss: parseFloat(pnl.toFixed(2)),
                    exitTime: new Date()
                }
            });

            await this.updateChannelPerformance(channelId);
            await this.updateTraderStats(updated);

            return updated;
        }

        // ENTRY MODE (default)
        const orderResult = await (isSimulated
            ? robinhoodSimulator.placeOptionOrder({
                symbol,
                type: 'market',
                side: action.toLowerCase(),
                quantity,
                strikePrice,
                optionType,
                expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                channelId
            })
            : tradingService.placeOptionOrder({
                symbol,
                type: 'market',
                side: action.toLowerCase(),
                quantity,
                strikePrice,
                optionType,
                expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                channelId
            })
        );

        const actualEntryPrice = entryPrice ?? orderResult?.price;
        if (!actualEntryPrice || isNaN(actualEntryPrice)) {
            throw new Error(`Invalid entry price for ${symbol} ${strikePrice} ${optionType}`);
        }

        const trade = await this.prisma.trade.create({
            data: {
                symbol,
                action,
                optionType,
                strikePrice,
                entryPrice: actualEntryPrice,
                quantity,
                status: 'OPEN',
                channel: {
                    connect: { id: channelId }
                }
            }
        });

        return trade;
    } catch (error) {
        console.error('Error tracking trade:', error);
        throw error;
    }
}

    async updateTrade(tradeId, updateData) {
        try {
            const trade = await this.prisma.trade.update({
                where: { id: tradeId },
                data: {
                    ...updateData,
                    exitTime: updateData.status === 'CLOSED' ? new Date() : undefined
                }
            });

            if (updateData.status === 'CLOSED') {
                await this.updateChannelPerformance(trade.channelId);
                await this.updateTraderStats(trade);
            }

            return trade;
        } catch (error) {
            console.error('Error updating trade:', error);
            throw error;
        }
    }

    async updateChannelPerformance(channelId) {
        try {
            const channel = await this.prisma.channel.findUnique({
                where: { id: channelId },
                include: {
                    trades: { where: { status: 'CLOSED' } }
                }
            });

            if (!channel) return;

            const trades = channel.trades;
            const totalTrades = trades.length;
            const winningTrades = trades.filter(t => t.profitLoss > 0).length;
            const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
            const avgProfit = totalTrades > 0
                ? trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / totalTrades
                : 0;
            const performance = (winRate * 0.6) + (avgProfit * 0.4);

            await this.prisma.channel.update({
                where: { id: channelId },
                data: {
                    totalTrades,
                    winRate,
                    avgProfit,
                    performance,
                    lastAnalyzed: new Date()
                }
            });

            await this.prisma.performanceHistory.create({
                data: {
                    channelId,
                    period: 'DAILY',
                    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
                    endDate: new Date(),
                    totalTrades,
                    winRate,
                    avgProfit,
                    performance
                }
            });
        } catch (error) {
            console.error('Error updating channel performance:', error);
            throw error;
        }
    }

    async getChannelStats(channelId) {
        try {
            const channel = await this.prisma.channel.findUnique({
                where: { id: channelId },
                include: {
                    trades: {
                        where: { status: 'CLOSED' },
                        orderBy: { exitTime: 'desc' },
                        take: 100
                    },
                    performanceHistory: {
                        orderBy: { endDate: 'desc' },
                        take: 30
                    }
                }
            });

            return channel;
        } catch (error) {
            console.error('Error getting channel stats:', error);
            throw error;
        }
    }

    async trackMessage(messageData) {
        try {
            const {
                channelId,
                channelName = 'Unknown',
                authorId,
                messageId,
                content,
                timestamp = new Date()
            } = messageData;

            await this.prisma.channel.upsert({
                where: { id: channelId },
                update: {},
                create: {
                    id: channelId,
                    name: channelName,
                    type: 'UNKNOWN'
                }
            });

            const message = await this.prisma.message.create({
                data: {
                    channelId,
                    discordId: messageId,
                    author: authorId,
                    content,
                    type: 'DISCORD',
                    createdAt: timestamp
                }
            });

            return message;
        } catch (error) {
            console.error('Error tracking message:', error);
            throw error;
        }
    }
    async updateTraderStats(trade) {
        if (!trade.author || !trade.channelId) return;

        const trades = await this.prisma.trade.findMany({
            where: {
                author: trade.author,
                channelId: trade.channelId,
                status: 'CLOSED'
            }
        });

        if (!trades.length) return;

        const total = trades.length;
        const wins = trades.filter(t => t.profitLoss > 0).length;
        const avgProfitLoss = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / total;

        // You can expand this to avgConfidence once you start storing it
        await this.prisma.traderStats.upsert({
            where: {
                author_channelId: {
                    author: trade.author,
                    channelId: trade.channelId
                }
            },
            update: {
                totalSignals: total,
                successfulSignals: wins,
                avgProfitLoss,
                lastActive: new Date()
            },
            create: {
                author: trade.author,
                channelId: trade.channelId,
                totalSignals: total,
                successfulSignals: wins,
                avgProfitLoss,
                lastActive: new Date()
            }
        });
    }

}


export const tradeTracker = new TradeTracker();
