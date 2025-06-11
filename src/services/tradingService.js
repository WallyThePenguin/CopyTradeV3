import robinhoodService from './robinhood.js';
import robinhoodSimulator from './robinhoodSimulator.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

class TradingService {
    constructor() {
        // Use Robinhood simulator for testing, real Robinhood for production
        this.service = process.env.ENVIRONMENT === 'PRODUCTION'
            ? robinhoodService
            : robinhoodSimulator;
    }

    async initialize() {
        await this.service.initialize();
    }

    async getQuote(symbol) {
        return await this.service.getQuote(symbol);
    }

    async getHistoricalPrices(symbol, interval = '5minute', span = 'day') {
        if (typeof this.service.getHistoricalPrices === 'function') {
            return await this.service.getHistoricalPrices(symbol, interval, span);
        }
        return [];
    }

    async placeOrder(orderData) {
        return await this.service.placeOrder(orderData);
    }

    async placeOptionOrder(orderData) {
        return await this.service.placeOptionOrder(orderData);
    }

    async updatePosition(tradeId, exitPrice) {
        return await this.service.updatePosition(tradeId, exitPrice);
    }

    getActivePositions() {
        return this.service.getActivePositions?.() || [];
    }

    async getPositions() {
        if (typeof this.service.getPositions === 'function') {
            return await this.service.getPositions();
        }
        return this.getActivePositions();
    }

    async getOrderHistory() {
        if (typeof this.service.getOrderHistory === 'function') {
            const history = await this.service.getOrderHistory();
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
        return await this.service.getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice);
    }
}

// Export singleton instance
export default new TradingService();
