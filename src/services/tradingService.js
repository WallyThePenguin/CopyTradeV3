import robinhoodService from './robinhood.js';
import robinhoodSimulator from './robinhoodSimulator.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { broadcastSignal } from '../web/websocket.js';

dotenv.config();
const prisma = new PrismaClient();

class TradingService {
    constructor() {
        this.mode = process.env.ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'TESTING';
        this.liveExecution = this.mode === 'PRODUCTION';
        this.useLiveMarketData = (process.env.USE_LIVE_MARKET_DATA ?? 'true').toLowerCase() === 'true';

        this.liveService = robinhoodService;
        this.simService = robinhoodSimulator;
        this.executionService = this.liveExecution ? this.liveService : this.simService;
    }

    async initialize() {
        if (this.useLiveMarketData || this.liveExecution) {
            await this.liveService.initialize();
        }
        if (!this.liveExecution) {
            await this.simService.initialize();
        }
    }

    _marketDataProvider() {
        if (this.liveExecution) return this.liveService;
        if (this.useLiveMarketData) return this.liveService;
        return this.simService;
    }

    async getQuote(symbol) {
        return await this._marketDataProvider().getQuote(symbol);
    }

    async getHistoricalPrices(symbol, interval = '5minute', span = 'day', options = {}) {
        const provider = this._marketDataProvider();
        if (typeof provider.getHistoricalPrices === 'function') {
            return await provider.getHistoricalPrices(symbol, { interval, span, ...options });
        }
        return [];
    }

    async placeOrder(orderData) {
        return await this.executionService.placeOrder(orderData);
    }

    async placeOptionOrder(orderData) {
        return await this.executionService.placeOptionOrder(orderData);
    }

    async updatePosition(tradeId, exitPrice) {
        return await this.executionService.updatePosition(tradeId, exitPrice);
    }

    getActivePositions() {
        return this.executionService.getActivePositions?.() || [];
    }

    async getPositions() {
        const provider = this._marketDataProvider();
        if (typeof provider.getPositions === 'function') {
            return await provider.getPositions();
        }
        return this.getActivePositions();
    }

    async getOrderHistory() {
        const provider = this._marketDataProvider();
        if (typeof provider.getOrderHistory === 'function') {
            const history = await provider.getOrderHistory();
            if (history?.results?.length) {
                for (const order of history.results) {
                    await prisma.orderRecord.upsert({
                        where: { brokerOrderId: order.id },
                        update: {
                            symbol: order.symbol,
                            type: order.type,
                            side: order.side,
                            quantity: order.quantity,
                            price: order.price ? parseFloat(order.price) : null,
                            status: order.status,
                            filledAt: order.created_at ? new Date(order.created_at) : null
                        },
                        create: {
                            brokerOrderId: order.id,
                            symbol: order.symbol,
                            type: order.type,
                            side: order.side,
                            quantity: order.quantity,
                            price: order.price ? parseFloat(order.price) : null,
                            status: order.status,
                            filledAt: order.created_at ? new Date(order.created_at) : null
                        }
                    });
                }
            }
            return history;
        }
        return [];
    }

    async getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice) {
        return await this._marketDataProvider().getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice);
    }
}

// Export singleton instance
export default new TradingService();

export async function initializeTradingService() {
    try {
        // Initialize any necessary trading service components
        logger.info('Initializing trading service...');

        // Check database connection
        await prisma.$connect();
        logger.info('Database connection established');

        // Initialize active channels
        const activeChannels = await prisma.channel.findMany({
            where: { enabled: true }
        });

        // Set up channel modes
        activeChannels.forEach(channel => {
            broadcastSignal('channel_mode_update', {
                channelId: channel.id,
                mode: channel.type
            });
        });

        logger.info(`Initialized ${activeChannels.length} active channels`);

        return true;
    } catch (error) {
        logger.error('Failed to initialize trading service:', error);
        throw error;
    }
}

// Export other trading-related functions as needed
export async function getActiveTrades() {
    return prisma.trade.findMany({
        where: { status: 'ACTIVE' },
        include: { channel: true }
    });
}

export async function getChannelPerformance(channelId) {
    const trades = await prisma.trade.findMany({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    const totalTrades = trades.length;
    const successfulTrades = trades.filter(t => t.status === 'SUCCESS').length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    return {
        totalTrades,
        successfulTrades,
        totalProfit,
        successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0
    };
}
