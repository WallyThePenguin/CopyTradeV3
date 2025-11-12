import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import tradingService from './tradingService.js';
import robinhoodSimulator from './robinhoodSimulator.js';
import { logExecution } from './auditLogger.js';
import { logger } from '../utils/logger.js';
import { broadcastTradeUpdate } from '../web/broadcast.js';
import calloutService from './calloutService.js';

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
                author = null,
                signalType = 'ENTRY',
                entryPrice = null,
                confidence = 1,
                calloutId = null,
                expirationDate = null
            } = tradeData;

            // Ensure the underlying trading service is ready before placing orders
            await tradingService.initialize();

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

            const env = process.env.ENVIRONMENT?.toUpperCase() || 'PRODUCTION';
            const isSimulated = env === 'TESTING' || channel.enabled === false;
            const tradeMode = isSimulated ? 'SIMULATED' : 'PRODUCTION';
            const resolvedExpirationDate = this._normalizeExpirationDate(expirationDate);

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
                    logger.warn('No open trade to close for:', { symbol, optionType, strikePrice });
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

                // Broadcast trade closure to all WebSocket clients
                await broadcastTradeUpdate(updated);

                await logExecution({
                    tradeId: updated.id,
                    channelId,
                    type: 'order_closed',
                    rawResponse: { exitPrice },
                    durationMs: 0
                });

                await this.prisma.executionStats.updateMany({
                    where: { tradeId: updated.id },
                    data: {
                        exitPrice,
                        exitConfidence: confidence,
                        pnl: parseFloat(pnl.toFixed(2)),
                        durationSec: updated.exitTime && updated.entryTime ? Math.floor((updated.exitTime - updated.entryTime) / 1000) : null,
                        result: pnl > 0 ? 'WIN' : 'LOSS'
                    }
                });

                await calloutService.recordTradeMatch({
                    calloutId: openTrade.calloutId,
                    tradeId: updated.id,
                    symbol,
                    price: exitPrice,
                    matchType: 'EXIT',
                    quoteSource: isSimulated ? 'simulated_exit' : 'execution_exit',
                    metadata: {
                        strikePrice,
                        optionType,
                        quantity,
                        pnl: parseFloat(pnl.toFixed(2)),
                        quoteTimestamp: new Date().toISOString()
                    }
                });

                return updated;
            }

            // ENTRY MODE (default)
            const orderStart = Date.now();
            const orderResult = await (isSimulated
                ? robinhoodSimulator.placeOptionOrder({
                    symbol,
                    type: 'market',
                    side: action.toLowerCase(),
                    quantity,
                    strikePrice,
                    optionType,
                    expirationDate: resolvedExpirationDate,
                    channelId
                })
                : tradingService.placeOptionOrder({
                    symbol,
                    type: 'market',
                    side: action.toLowerCase(),
                    quantity,
                    strikePrice,
                    optionType,
                    expirationDate: resolvedExpirationDate,
                    channelId
                })
            );
            const orderDuration = Date.now() - orderStart;

            const actualEntryPrice = entryPrice ?? orderResult?.price;
            if (!actualEntryPrice || isNaN(actualEntryPrice)) {
                throw new Error(`Invalid entry price for ${symbol} ${strikePrice} ${optionType}`);
            }

            const newTradeData = {
                symbol,
                action,
                optionType,
                strikePrice,
                entryPrice: actualEntryPrice,
                quantity,
                author,
                mode: tradeMode,
                status: 'OPEN',
                channel: {
                    connect: { id: channelId }
                }
            };

            if (calloutId) {
                newTradeData.callout = {
                    connect: { id: calloutId }
                };
            }

            const trade = await this.prisma.trade.create({
                data: newTradeData
            });

            // Broadcast new trade to all WebSocket clients
            await broadcastTradeUpdate(trade);

            await logExecution({
                tradeId: trade.id,
                channelId,
                type: 'order_placed',
                statusCode: 201,
                rawResponse: orderResult,
                durationMs: orderDuration
            });

            // record execution stats so we always use the table
            await this.prisma.executionStats.create({
                data: {
                    tradeId: trade.id,
                    executedAt: new Date(),
                    executedPrice: actualEntryPrice,
                    result: 'OPEN'
                }
            });

            if (calloutId) {
                await calloutService.attachTrade(calloutId, trade.id);
            }

            await calloutService.recordTradeMatch({
                calloutId,
                tradeId: trade.id,
                symbol,
                price: actualEntryPrice,
                matchType: 'ENTRY',
                quoteSource: isSimulated ? 'simulated_entry' : 'execution_entry',
                metadata: {
                    orderId: orderResult?.id ?? null,
                    latencyMs: orderDuration,
                    strikePrice,
                    optionType,
                    quantity,
                    expirationDate: resolvedExpirationDate,
                    quoteTimestamp: new Date().toISOString()
                }
            });

            return trade;
        } catch (error) {
            logger.error('Error tracking trade:', error);
            throw error;
        }
    }

    async updateTrade(tradeId, updateData) {
        try {
            const trade = await this.prisma.trade.update({
                where: { id: tradeId },
                data: {
                    ...updateData,
                    exitTime: updateData.status === 'CLOSED' ? new Date() : undefined,
                    durationSec: updateData.status === 'CLOSED' && updateData.exitTime && updateData.entryTime
                        ? Math.floor((new Date(updateData.exitTime) - new Date(updateData.entryTime)) / 1000)
                        : undefined
                }
            });

            if (updateData.status === 'CLOSED') {
                await this.prisma.executionStats.updateMany({
                    where: { tradeId },
                    data: {
                        exitPrice: updateData.exitPrice,
                        exitConfidence: updateData.confidence,
                        pnl: updateData.profitLoss,
                        durationSec: trade.exitTime && trade.entryTime ? Math.floor((trade.exitTime - trade.entryTime) / 1000) : null,
                        result: updateData.profitLoss > 0 ? 'WIN' : 'LOSS'
                    }
                });
                await this.updateChannelPerformance(trade.channelId);
                await this.updateTraderStats(trade);
            }

            return trade;
        } catch (error) {
            logger.error('Error updating trade:', error);
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
            logger.error('Error updating channel performance:', error);
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
            logger.error('Error getting channel stats:', error);
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
                timestamp = new Date(),
                parsedData = null,
                modelUsed = null,
                parsedAt = null
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

            // Ensure TraderStats exists for this author/channelId
            await this.prisma.traderStats.upsert({
                where: { author_channelId: { author: authorId, channelId } },
                update: {},
                create: {
                    author: authorId,
                    channelId,
                    totalSignals: 0,
                    successfulSignals: 0,
                    avgConfidence: 0,
                    avgProfitLoss: 0,
                    bestSymbols: JSON.stringify([]),
                    tradingHours: JSON.stringify([]),
                    lastActive: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });

            const normalizedParsedData = parsedData == null
                ? null
                : (typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData));

            const message = await this.prisma.message.create({
                data: {
                    channelId,
                    discordId: messageId,
                    author: authorId,
                    content,
                    parsedData: normalizedParsedData,
                    modelUsed,
                    parsedAt,
                    type: 'DISCORD',
                    createdAt: timestamp
                }
            });

            return message;
        } catch (error) {
            logger.error('Error tracking message:', error);
            throw error;
        }
    }

    async logModelResult(log) {
        const { messageId, prompt, response, inputTokens = 0, outputTokens = 0, latencyMs = 0, modelName = 'mistral' } = log;
        try {
            return await this.prisma.modelLog.create({
                data: {
                    messageId,
                    prompt,
                    response: JSON.stringify(response),
                    inputTokens,
                    outputTokens,
                    latencyMs,
                    modelName
                }
            });
        } catch (error) {
            logger.error('Error logging model result:', error);
            throw error;
        }
    }

    async logTradeSignal(signal) {
        const {
            tradeId,
            confidence,
            triggeredAt = new Date(),
            source = 'DISCORD',
            autoExecuted = false
        } = signal;
        try {
            return await this.prisma.tradeSignal.create({
                data: { tradeId, confidence, triggeredAt, source, autoExecuted }
            });
        } catch (error) {
            logger.error('Error logging trade signal:', error);
            throw error;
        }
    }
    async updateTraderStats(trade) {
        let traderName = trade.author;
        if (!traderName) {
            const channel = trade.channel || await this.prisma.channel.findUnique({ where: { id: trade.channelId } });
            traderName = channel ? channel.name : `channel:${trade.channelId}`;
        }
        if (!traderName || !trade.channelId) return;

        const trades = await this.prisma.trade.findMany({
            where: {
                author: traderName,
                channelId: trade.channelId,
                status: 'CLOSED'
            }
        });

        if (!trades.length) return;

        const closed = trades.filter(t => t.profitLoss !== null && t.profitLoss !== undefined);
        const total = closed.length;
        const wins = closed.filter(t => t.profitLoss > 0).length;
        const avgProfitLoss = total > 0 ? closed.reduce((sum, t) => sum + t.profitLoss, 0) / total : 0;

        // You can expand this to avgConfidence once you start storing it
            await this.prisma.traderStats.upsert({
                where: {
                    author_channelId: {
                        author: traderName,
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
                    author: traderName,
                    channelId: trade.channelId,
                    totalSignals: total,
                    successfulSignals: wins,
                    avgProfitLoss,
                    bestSymbols: JSON.stringify([]),
                    tradingHours: JSON.stringify([]),
                    lastActive: new Date()
                }
            });
    }

    _normalizeExpirationDate(value) {
        if (value) {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
            logger.warn('Invalid expiration date supplied, defaulting to next Friday', { value });
        }
        return this._getNextFriday();
    }

    _getNextFriday(referenceDate = new Date()) {
        const date = new Date(referenceDate);
        const day = date.getUTCDay();
        const offset = (5 - day + 7) % 7;
        date.setUTCDate(date.getUTCDate() + offset);
        return date.toISOString().split('T')[0];
    }
}


export const tradeTracker = new TradeTracker();
