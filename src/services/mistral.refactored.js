import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import Trade from '../models/trade.js';
import Signal from '../models/signal.js';
import tradingService from './tradingService.js';
import BaseService from './base/BaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for interacting with the Mistral AI model
 */
class MistralService extends BaseService {
    static instance = null;

    /**
     * Create a new MistralService instance or return the existing one
     */
    constructor() {
        super('Mistral');
        
        if (MistralService.instance) {
            logger.info('Returning existing MistralService instance');
            return MistralService.instance;
        }
        
        MistralService.instance = this;
        
        this.activeTrades = new Map();
        this.tradeHistory = [];
        this.historyFile = path.join(__dirname, '..', '..', 'data', 'trades', 'history.json');
        this.loadHistory();
    }

    /**
     * Get the singleton instance
     * @returns {MistralService} The singleton instance
     */
    static getInstance() {
        if (!MistralService.instance) {
            logger.info('Creating new MistralService instance via getInstance');
            MistralService.instance = new MistralService();
        }
        return MistralService.instance;
    }

    /**
     * Load trade history from file
     * @returns {Promise<void>}
     */
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

    /**
     * Save trade history to file
     * @returns {Promise<void>}
     */
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

    /**
     * Implementation of service initialization
     * @returns {Promise<void>}
     * @protected
     */
    async _initializeImplementation() {
        // Check if Python server is running
        const response = await axios.get('http://localhost:8000/health');
        if (response.data.status !== 'healthy') {
            throw new Error('Python server is not healthy');
        }
        
        logger.info('Mistral service initialized successfully', {
            gpu_info: response.data.gpu_info
        });
    }

    /**
     * Analyze a message for trade signals
     * @param {string} content - Message content to analyze
     * @returns {Promise<Signal>} Analysis result
     */
    async analyzeMessage(content) {
        this.ensureInitialized();

        try {
            const standardized = content.replace(/(\b[A-Z]{1,5})\s+(\d+)\s+(CALL|PUT)\b/gi,
                (_, sym, strike, type) => `${sym} ${strike} ${type.charAt(0)}`);
            logger.info('Starting message analysis', { content: standardized });

            const response = await axios.post('http://localhost:8000/analyze', {
                content: standardized
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

    /**
     * Track a new trade
     * @param {Signal} signal - Trade signal
     * @returns {Promise<void>}
     */
    async trackTrade(signal) {
        const trade = new Trade(signal);
        this.activeTrades.set(trade.key, trade);

        this.tradeHistory.push(trade);
        await this.saveHistory();
    }

    /**
     * Close an existing trade
     * @param {Object} tradeInfo - Trade information
     * @returns {Promise<Trade|null>} Closed trade or null if not found
     */
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

    /**
     * Get context information about active and recent trades
     * @returns {Object} Trade context
     */
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

    /**
     * Start the stoploss checker interval
     */
    startStoplossChecker() {
        setInterval(() => this.checkStoploss(), 60000);
    }

    /**
     * Check stoploss conditions for active trades
     * @returns {Promise<void>}
     */
    async checkStoploss() {
        for (const [tradeKey, trade] of this.activeTrades) {
            if (trade.status !== 'ACTIVE') continue;

            try {
                const currentPrice = await this.getCurrentPrice(trade.symbol);

                // Check stoploss
                if (trade.stopLoss) {
                    if (trade.action === 'BUY' && currentPrice <= trade.stopLoss) {
                        logger.info(`Stoploss triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'STOPLOSS',
                            exitPrice: currentPrice
                        });
                    } else if (trade.action === 'SELL' && currentPrice >= trade.stopLoss) {
                        logger.info(`Stoploss triggered for ${trade.symbol} at ${currentPrice}`);
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
                        logger.info(`Take profit triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'TAKE_PROFIT',
                            exitPrice: currentPrice
                        });
                    } else if (trade.action === 'SELL' && currentPrice <= trade.takeProfit) {
                        logger.info(`Take profit triggered for ${trade.symbol} at ${currentPrice}`);
                        await this.closeTrade({
                            ...trade,
                            action: 'close',
                            exitReason: 'TAKE_PROFIT',
                            exitPrice: currentPrice
                        });
                    }
                }
            } catch (error) {
                logger.error(`Error checking stoploss for ${trade.symbol}:`, error);
            }
        }
    }

    /**
     * Get current price for a symbol
     * @param {string} symbol - Symbol to get price for
     * @returns {Promise<number>} Current price
     */
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