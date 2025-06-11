import robinhoodService from './robinhood.js';
import robinhoodSimulator from './robinhoodSimulator.js';
import dotenv from 'dotenv';

dotenv.config();

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
    async getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice) {
        return await this.service.getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice);
    }
}

// Export singleton instance
export default new TradingService(); 