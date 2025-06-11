import { PrismaClient } from '@prisma/client';
import robinhoodService from './robinhood.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

class RobinhoodSimulator {
    constructor() {
        this.prisma = prisma;
        this.activePositions = new Map(); // Track simulated positions
        this.priceHistory = new Map(); // Cache recent prices
    }

    async initialize() {
        console.log('Initializing Robinhood simulator...');
        // Initialize Robinhood service
        await robinhoodService.initialize();
    }

    async getQuote(symbol) {
        try {
            // Get real-time quote from Robinhood
            const quote = await robinhoodService.getQuote(symbol);

            // Cache the price
            const parsedPrice = parseFloat(quote.last_trade_price || quote.last_extended_hours_trade_price || 0);
            this.priceHistory.set(symbol, parsedPrice);

            // Record price snapshot
            await this.prisma.priceSnapshot.create({
                data: {
                    symbol,
                    source: 'robinhood_simulator',
                    price: parsedPrice
                }
            });

            return quote;
        } catch (error) {
            console.error(`Error getting quote for ${symbol}:`, error);
            throw error;
        }
    }

    async placeOrder(orderData) {
        const {
            symbol,
            type,
            side,
            quantity,
            price,
            timeInForce = 'gfd',
            extendedHours = false
        } = orderData;

        try {
            // Get real-time quote
            const quote = await this.getQuote(symbol);
            const executionPrice = type === 'market' ? quote.price : price;

            // Record execution stats
            const executionStats = await this.prisma.executionStats.create({
                data: {
                    executedAt: new Date(),
                    executedPrice: executionPrice,
                    result: 'OPEN',
                    durationSec: 0
                }
            });

            // Track position
            const positionKey = `${symbol}_${side}`;
            const currentPosition = this.activePositions.get(positionKey) || {
                symbol,
                side,
                quantity: 0,
                averagePrice: 0
            };

            // Update position
            const newQuantity = side === 'buy'
                ? currentPosition.quantity + quantity
                : currentPosition.quantity - quantity;

            const newAveragePrice = side === 'buy'
                ? ((currentPosition.averagePrice * currentPosition.quantity) + (executionPrice * quantity)) / newQuantity
                : currentPosition.averagePrice;

            this.activePositions.set(positionKey, {
                ...currentPosition,
                quantity: newQuantity,
                averagePrice: newAveragePrice
            });

            console.log(`Simulated ${side.toUpperCase()} order executed:`, {
                symbol,
                quantity,
                price: executionPrice,
                type,
                timeInForce,
                position: this.activePositions.get(positionKey)
            });

            return {
                id: executionStats.id,
                symbol,
                side,
                quantity,
                price: executionPrice,
                status: 'FILLED',
                type,
                timeInForce,
                executionStats,
                position: this.activePositions.get(positionKey)
            };
        } catch (error) {
            console.error('Error placing simulated order:', error);
            throw error;
        }
    }

    async placeOptionOrder(orderData) {
        const {
            symbol,
            type,
            side,
            quantity,
            strikePrice,
            expirationDate,
            optionType,
            price,
            timeInForce = 'gfd',
            extendedHours = false,
            channelId
        } = orderData;

        try {
            // Get option data using robinhoodService
            const option = await robinhoodService.getOptionData(symbol, strikePrice, optionType, expirationDate);

            if (!option) {
                throw new Error(`Option not found: ${symbol} ${strikePrice} ${optionType} ${expirationDate}`);
            }

            const executionPrice = type === 'market' ? (option.mark_price ?? option.price) : price;

            const trade = await prisma.trade.create({
  data: {
    symbol,
    action: side.toUpperCase(),
    optionType,
    strikePrice,
    entryPrice: executionPrice,
    quantity,
    status: 'OPEN',
    channel: {
      connect: { id: channelId }
    }
  }
});

const executionStats = await prisma.executionStats.create({
  data: {
    executedAt: new Date(),
    executedPrice: executionPrice,
    result: 'OPEN',
    durationSec: 0,
    trade: {
      connect: { id: trade.id }
    }
  }
});

            // Track option position
            const positionKey = `${symbol}_${strikePrice}_${optionType}_${expirationDate}_${side}`;
            const currentPosition = this.activePositions.get(positionKey) || {
                symbol,
                strikePrice,
                optionType,
                expirationDate,
                side,
                quantity: 0,
                averagePrice: 0
            };

            const newQuantity = side === 'buy'
                ? currentPosition.quantity + quantity
                : currentPosition.quantity - quantity;

            const newAveragePrice = side === 'buy'
                ? ((currentPosition.averagePrice * currentPosition.quantity) + (executionPrice * quantity)) / newQuantity
                : currentPosition.averagePrice;

            this.activePositions.set(positionKey, {
                ...currentPosition,
                quantity: newQuantity,
                averagePrice: newAveragePrice
            });

            console.log(`Simulated ${optionType} ${side.toUpperCase()} option order executed:`, {
                symbol,
                strikePrice,
                expirationDate,
                quantity,
                price: executionPrice,
                type,
                timeInForce,
                position: this.activePositions.get(positionKey)
            });

            return {
                id: executionStats.id,
                symbol,
                side,
                quantity,
                strikePrice,
                expirationDate,
                optionType,
                price: executionPrice,
                status: 'FILLED',
                type,
                timeInForce,
                executionStats,
                position: this.activePositions.get(positionKey)
            };
        } catch (error) {
            console.error('Error placing simulated option order:', error);
            throw error;
        }
    }


    async updatePosition(tradeId, exitPrice) {
        const trade = await this.prisma.trade.findUnique({
            where: { id: tradeId },
            include: { executionStats: true }
        });

        if (!trade) throw new Error('Trade not found');

        const entryPrice = trade.executionStats[0].executedPrice;
        const pnl = trade.action === 'BUY'
            ? (exitPrice - entryPrice) * trade.quantity
            : (entryPrice - exitPrice) * trade.quantity;

        const durationSec = Math.floor((new Date() - trade.entryTime) / 1000);

        // Update execution stats
        await this.prisma.executionStats.update({
            where: { id: trade.executionStats[0].id },
            data: {
                exitPrice,
                pnl,
                durationSec,
                result: pnl > 0 ? 'WIN' : 'LOSS'
            }
        });

        // Update trade
        await this.prisma.trade.update({
            where: { id: tradeId },
            data: {
                exitPrice,
                profitLoss: pnl,
                status: 'CLOSED',
                exitTime: new Date()
            }
        });

        // Update position tracking
        const positionKey = trade.optionType
            ? `${trade.symbol}_${trade.strikePrice}_${trade.optionType}_${trade.expirationDate}_${trade.action}`
            : `${trade.symbol}_${trade.action}`;

        this.activePositions.delete(positionKey);

        return {
            tradeId,
            pnl,
            durationSec,
            result: pnl > 0 ? 'WIN' : 'LOSS'
        };
    }
async getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice) {
    const movement = (Math.random() - 0.5) * 0.4; // ±20%
    const simulatedExit = entryPrice * (1 + movement);
    const exitPrice = parseFloat(simulatedExit.toFixed(2));

    console.log(`[SIMULATOR EXIT] ${symbol} ${strikePrice}${optionType} → $${exitPrice}`);

    await this.prisma.priceSnapshot.create({
        data: {
            symbol: `${symbol}${strikePrice}${optionType}`,
            source: 'simulated_exit',
            price: exitPrice,
            recordedAt: new Date()
        }
    });

    return exitPrice;
}

    getActivePositions() {
        return Array.from(this.activePositions.values());
    }
}

// Export singleton instance
export default new RobinhoodSimulator(); 