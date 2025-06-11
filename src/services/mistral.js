import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import Trade from '../models/trade.js';
import Signal from '../models/signal.js';
import tradingService from './tradingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logging utility
const debugLog = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = data
        ? `${timestamp} - ${message}: ${JSON.stringify(data, null, 2)}`
        : `${timestamp} - ${message}`;
    console.log(logMessage);
};

class MistralService {
    static instance = null;
    static isInitializing = false;

    constructor() {
        if (MistralService.instance) {
            logger.info('Returning existing MistralService instance');
            return MistralService.instance;
        }
        MistralService.instance = this;
        logger.info('Creating new MistralService instance');

        this.initialized = false;
        this.activeTrades = new Map();
        this.tradeHistory = [];
        this.historyFile = path.join(__dirname, '..', '..', 'data', 'trades', 'history.json');
        this.loadHistory();
    }

    static getInstance() {
        if (!MistralService.instance) {
            logger.info('Creating new MistralService instance via getInstance');
            MistralService.instance = new MistralService();
        }
        return MistralService.instance;
    }

    async loadHistory() {
        try {
            const dataDir = path.dirname(this.historyFile);
            await fs.mkdir(dataDir, { recursive: true });

            try {
                const data = await fs.readFile(this.historyFile, 'utf8');
                this.tradeHistory = JSON.parse(data).map(trade => Trade.fromJSON(trade));
                logger.info('Trade history loaded successfully', { count: this.tradeHistory.length });
            } catch (readError) {
                if (readError.code === 'ENOENT') {
                    await this.saveHistory();
                    logger.info('Created new trade history file');
                } else {
                    throw readError;
                }
            }
        } catch (error) {
            logger.error('Error loading trade history', error);
            this.tradeHistory = [];
        }
    }

    async saveHistory() {
        try {
            const dataDir = path.dirname(this.historyFile);
            await fs.mkdir(dataDir, { recursive: true });

            const historyData = this.tradeHistory.map(trade => trade.toJSON());
            await fs.writeFile(this.historyFile, JSON.stringify(historyData, null, 2));
            logger.info('Trade history saved successfully', {
                count: this.tradeHistory.length,
                path: this.historyFile
            });
        } catch (error) {
            logger.error('Error saving trade history', error);
        }
    }

    async initialize() {
        if (this.initialized) {
            logger.info('Mistral service already initialized');
            return;
        }

        if (MistralService.isInitializing) {
            logger.info('Mistral service is already initializing');
            return;
        }

        MistralService.isInitializing = true;
        logger.info('Starting Mistral service initialization');

        try {
            // Check if Python server is running
            const response = await axios.get('http://localhost:8000/health');
            if (response.data.status === 'healthy') {
                this.initialized = true;
                logger.info('Mistral service initialized successfully', {
                    gpu_info: response.data.gpu_info
                });
            } else {
                throw new Error('Python server is not healthy');
            }
        } catch (error) {
            logger.error('Error during Mistral service initialization', error);
            throw error;
        } finally {
            MistralService.isInitializing = false;
        }
    }

    async analyzeMessage(content) {
        if (!this.initialized) {
            logger.warn('Attempted to analyze message before service initialization');
            throw new Error('Mistral service not initialized');
        }

        try {
            logger.info('Starting message analysis', { content });

            const response = await axios.post('http://localhost:8000/analyze', {
                content: content
            });

            const signal = Signal.fromJSON(response.data);
            logger.info('Received analysis from Python server', signal.toJSON());

            if (signal.isValid()) {
                logger.info('Tracking new trade signal', signal.toJSON());
                await this.trackTrade(signal);
            }

            return signal;
        } catch (error) {
            logger.error('Error analyzing message', error);
            throw error;
        }
    }

    async trackTrade(signal) {
        const trade = new Trade(signal);
        this.activeTrades.set(trade.key, trade);

        this.tradeHistory.push(trade);
        await this.saveHistory();
    }

    async closeTrade(tradeInfo) {
        const trade = this.activeTrades.get(tradeInfo.key);

        if (trade) {
            trade.status = 'CLOSED';
            trade.exitReason = tradeInfo.action;
            trade.exitTime = Date.now();

            this.tradeHistory.push(trade);
            this.activeTrades.delete(trade.key);
            await this.saveHistory();

            return trade;
        }

        return null;
    }

    getTradeContext() {
        const activeTrades = Array.from(this.activeTrades.values());
        const recentTrades = this.tradeHistory.slice(-3);

        return {
            activeTrades: activeTrades.map(trade =>
                `${trade.symbol} ${trade.strikePrice} ${trade.optionType} @${trade.entryPrice}`
            ).join('\n'),
            recentTrades: recentTrades.map(trade =>
                `${trade.action}: ${trade.symbol} ${trade.strikePrice} ${trade.optionType} @${trade.entryPrice}`
            ).join('\n')
        };
    }

    startStoplossChecker() {
        setInterval(() => this.checkStoploss(), 60000);
    }

    async checkStoploss() {
        for (const [tradeKey, trade] of this.activeTrades) {
            if (trade.status !== 'ACTIVE') continue;

            try {
                const currentPrice = await this.getCurrentPrice(trade.symbol);

                // Check stoploss
                if (trade.stopLoss) {
                    if (trade.action === 'BUY' && currentPrice <= trade.stopLoss) {
                        console.log(`Stoploss triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'STOPLOSS',
                            exitPrice: currentPrice
                        });
                    } else if (trade.action === 'SELL' && currentPrice >= trade.stopLoss) {
                        console.log(`Stoploss triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'STOPLOSS',
                            exitPrice: currentPrice
                        });
                    }
                }

                // Check take profit
                if (trade.takeProfit) {
                    if (trade.action === 'BUY' && currentPrice >= trade.takeProfit) {
                        console.log(`Take profit triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'TAKE_PROFIT',
                            exitPrice: currentPrice
                        });
                    } else if (trade.action === 'SELL' && currentPrice <= trade.takeProfit) {
                        console.log(`Take profit triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'TAKE_PROFIT',
                            exitPrice: currentPrice
                        });
                    }
                }
            } catch (error) {
                console.error(`Error checking stoploss for ${trade.symbol}:`, error);
            }
        }
    }

    async getCurrentPrice(symbol) {
        try {
            const quote = await tradingService.getQuote(symbol);
            const price = parseFloat(quote.last_trade_price || quote.price || 0);
            return isNaN(price) ? 0 : price;
        } catch (error) {
            logger.error('Error fetching current price', { symbol, error });
            return 0;
        }
    }
}

// Create and export a singleton instance
export const mistralService = MistralService.getInstance(); 