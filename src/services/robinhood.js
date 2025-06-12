import Robinhood from 'robinhood-api';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const envPath = path.join(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

class RobinhoodService {
    constructor() {
        if (RobinhoodService.instance) return RobinhoodService.instance;
        RobinhoodService.instance = this;

        this.username = process.env.ROBINHOOD_USERNAME;
        this.password = process.env.ROBINHOOD_PASSWORD;
        this.token = process.env.ROBINHOOD_TOKEN;
        this.isLoggedIn = false;
        this.accountInfo = null;
        this.tokenFile = path.join(__dirname, '../../robinhood_token.json');
        this.client = null;
        this.testMode = process.env.ENVIRONMENT?.toUpperCase() === 'TESTING';

        console.log('RobinhoodService initialized with:');
        console.log('Mode:', this.testMode ? 'TESTING' : 'PRODUCTION');

        this.initialized = this._initializeClient();
    }

    async initialize(force = false) {
        if (!this.initialized || force) {
            this.initialized = this._initializeClient();
        }
        return this.initialized;
    }

    async _initializeClient() {
        this.client = new Robinhood();

        if (this.token) {
            console.log('Using provided token...');
            this.client.session = { headers: { Authorization: `Bearer ${this.token}` } };
            this.isLoggedIn = true;
            return;
        }

        const savedToken = await this._loadSavedToken();
        if (savedToken) {
            console.log('Using saved token...');
            this.client.session = { headers: { Authorization: `Bearer ${savedToken}` } };
            this.isLoggedIn = true;
            return;
        }

        if (this.username && this.password) {
            try {
                const loginResult = await this.client.login(this.username, this.password);
                const token = loginResult.token || loginResult.access_token;
                if (token) {
                    this.client.session = { headers: { Authorization: `Bearer ${token}` } };
                    this.isLoggedIn = true;
                    await this._saveToken(token);
                }
            } catch (error) {
                console.error('Login failed:', error);
            }
        }
    }

    async _loadSavedToken() {
        try {
            const data = await fs.readFile(this.tokenFile, 'utf8');
            const saved = JSON.parse(data);
            if (saved.token && saved.expires_at && new Date(saved.expires_at) > new Date()) {
                return saved.token;
            }
        } catch {}
        return null;
    }

    async _saveToken(token) {
        const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const data = JSON.stringify({ token, expires_at });
        await fs.writeFile(this.tokenFile, data, 'utf8');
    }

    async _validateSession() {
        if (!this.isLoggedIn || !this.client.session?.headers?.Authorization) return false;
        try {
            const accounts = await this.client.getAccounts();
            this.accountInfo = accounts.results?.[0] || null;
            return !!this.accountInfo;
        } catch {
            this.isLoggedIn = false;
            return false;
        }
    }

    async ensureSession() {
        await this.initialized;
        if (!this.isLoggedIn || !(await this._validateSession())) {
            console.warn('Robinhood session invalid, attempting re-login...');
            await this._initializeClient();
            if (!this.isLoggedIn || !(await this._validateSession())) {
                console.error('Unable to establish Robinhood session');
                return false;
            }
        }
        return true;
    }

    async getQuote(symbol) {
        if (this.testMode) {
            const price = 500 + Math.random() * 50;
            await prisma.priceSnapshot.create({
                data: { symbol, source: 'robinhood_simulator', price, recordedAt: new Date() }
            });
            return { symbol, last_trade_price: price.toFixed(2) };
        }
        await this.ensureSession();
        return await this.client.getQuote({ symbol });
    }

    async getHistoricalPrices(symbol, interval = '5minute', span = 'day') {
        if (this.testMode) {
            const now = Date.now();
            return Array.from({ length: 12 }, (_, i) => ({
                begins_at: new Date(now - i * 5 * 60 * 1000),
                close_price: (500 + Math.random() * 50).toFixed(2)
            })).reverse();
        }
        await this.ensureSession();
        const url = `https://api.robinhood.com/quotes/historicals/${symbol}/?interval=${interval}&span=${span}&bounds=regular`;
        const res = await fetch(url, {
            headers: this.client.session?.headers || {}
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch historical prices: ${res.status}`);
        }
        const data = await res.json();
        return data.historicals || [];
    }

    async getOptionData(symbol, strikePrice, optionType, expirationDate) {
        if (this.testMode) {
            const price = 2.0 + Math.random() * 1.5;
            return {
                symbol: `${symbol}${strikePrice}${optionType}`,
                strike_price: strikePrice,
                expiration_date: expirationDate,
                type: optionType,
                price: parseFloat(price.toFixed(2)),
                mark_price: parseFloat(price.toFixed(2)),
                bid: parseFloat((price - 0.1).toFixed(2)),
                ask: parseFloat((price + 0.1).toFixed(2))
            };
        }

        await this.ensureSession();

        const chain = await this.client.options.getChain(symbol);
        const options = await this.client.options.getOptions(chain.id, {
            type: optionType.toLowerCase(),
            expiration_dates: [expirationDate]
        });

        const match = options.results.find(opt =>
            parseFloat(opt.strike_price) === parseFloat(strikePrice) &&
            opt.expiration_date === expirationDate
        );

        if (!match) {
            throw new Error(`No matching option found for ${symbol} ${strikePrice} ${optionType}`);
        }

        const markPrice = parseFloat(match.adjusted_mark_price);

        await prisma.priceSnapshot.create({
            data: {
                symbol: match.symbol,
                source: 'robinhood_api',
                price: markPrice,
                recordedAt: new Date()
            }
        });

        return {
            symbol: match.symbol,
            strike_price: parseFloat(match.strike_price),
            expiration_date: match.expiration_date,
            type: match.type,
            price: markPrice,
            mark_price: markPrice,
            bid: parseFloat(match.bid_price),
            ask: parseFloat(match.ask_price)
        };
    }

    async simulateExitPrice(entryPrice) {
        const movement = (Math.random() - 0.5) * 0.4;
        const exitPrice = parseFloat((entryPrice * (1 + movement)).toFixed(2));
        console.log(`[SIMULATED EXIT] $${entryPrice.toFixed(2)} → $${exitPrice}`);
        return exitPrice;
    }

    async getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice) {
        if (this.testMode) {
            return await this.simulateExitPrice(entryPrice);
        }

        try {
            const optionData = await this.getOptionData(symbol, strikePrice, optionType, expirationDate);
            const price = optionData?.price;

            if (!price || isNaN(price)) {
                throw new Error('Invalid exit price from getOptionData');
            }

            await prisma.priceSnapshot.create({
                data: {
                    symbol,
                    source: 'robinhood_api',
                    price,
                    recordedAt: new Date()
                }
            });

            console.log(`[REAL EXIT] ${symbol} ${strikePrice}${optionType} → $${price.toFixed(2)}`);
            return parseFloat(price.toFixed(2));
        } catch (error) {
            console.error('[ERROR] getExitPrice:', error);
            throw error;
        }
    }

    async placeOrder(orderData) {
        if (this.testMode) {
            return {
                id: `test-order-${Date.now()}`,
                ...orderData,
                status: 'filled',
                created_at: new Date().toISOString()
            };
        }
        await this.ensureSession();
        return await this.client.placeOrder(orderData);
    }

    async placeOptionOrder(orderData) {
        return await this.placeOrder(orderData);
    }

    async cancelOrder(orderId) {
        if (this.testMode) {
            return {
                id: orderId,
                status: 'cancelled',
                cancelled_at: new Date().toISOString()
            };
        }
        await this.ensureSession();
        return await this.client.cancelOrder({ order_id: orderId });
    }

    async getAccountInfo() {
        if (this.testMode) {
            return {
                account_number: 'TEST-123456',
                buying_power: 100000,
                cash: 50000,
                portfolio_value: 150000,
                equity: 150000,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }
        await this.ensureSession();
        const accounts = await this.client.getAccounts();
        return accounts.results[0];
    }

    async getPositions() {
        if (this.testMode) {
            return {
                results: [
                    {
                        symbol: 'QQQ',
                        quantity: 10,
                        average_buy_price: '500.00',
                        equity: '5080.00',
                        market_value: '5080.00',
                        type: 'stock'
                    }
                ]
            };
        }
        await this.ensureSession();
        return await this.client.getPositions();
    }

    async getOrderHistory() {
        if (this.testMode) {
            return {
                results: [
                    {
                        id: 'test-order-1',
                        symbol: 'QQQ',
                        type: 'limit',
                        side: 'buy',
                        quantity: 1,
                        price: '508.00',
                        status: 'filled',
                        created_at: new Date(Date.now() - 3600000).toISOString()
                    }
                ]
            };
        }
        await this.ensureSession();
        return await this.client.getRecentOrders();
    }
}

// ✅ Export singleton
export default new RobinhoodService();
