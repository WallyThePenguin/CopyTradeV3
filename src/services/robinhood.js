import Robinhood from 'robinhood-api';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const envPath = path.join(__dirname, '../../.env');
logger.info('Loading .env from:', envPath);
dotenv.config({ path: envPath });

class RobinhoodService {
    constructor() {
        if (RobinhoodService.instance) return RobinhoodService.instance;
        RobinhoodService.instance = this;

        this.username = process.env.ROBINHOOD_USERNAME;
        this.password = process.env.ROBINHOOD_PASSWORD;
        this.token =
            process.env.ROBINHOOD_TOKEN ||
            process.env.ACCESS_TOKEN ||
            process.env.ROBINHOOD_ACCESS_TOKEN ||
            null;
        this.isLoggedIn = false;
        this.accountInfo = null;
        this.tokenFile = path.join(__dirname, '../../robinhood_token.json');
        this.client = null;
        this.testMode = process.env.ENVIRONMENT?.toUpperCase() === 'TESTING';
        this.tokenTtlMs =
            parseInt(process.env.ROBINHOOD_TOKEN_TTL_HOURS || '24', 10) * 60 * 60 * 1000;
        this.deviceTokenFile = path.join(__dirname, '../../robinhood_device_token.json');
        this.deviceToken = null;
        this.oauthClientId =
            process.env.ROBINHOOD_CLIENT_ID || 'c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS';
        this.oauthScope = process.env.ROBINHOOD_SCOPE || 'internal';
        this.oauthTokenUrl = 'https://api.robinhood.com/oauth2/token/';
        this.oauthChallengeUrl = (id) => `https://api.robinhood.com/challenge/${id}/respond/`;
        this.useLiveMarketData =
            (process.env.USE_LIVE_MARKET_DATA ?? 'false').toLowerCase() === 'true';

        logger.info('RobinhoodService initialized with:');
        logger.info('Mode:', this.testMode ? 'TESTING' : 'PRODUCTION');

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
        await this._ensureDeviceToken();

        if (this.token) {
            logger.info('Using provided token...');
            this.client.session = { headers: { Authorization: `Bearer ${this.token}` } };
            this.isLoggedIn = true;
            return;
        }

        const savedToken = await this._loadSavedToken();
        if (savedToken) {
            logger.info('Using saved token...');
            this.client.session = { headers: { Authorization: `Bearer ${savedToken}` } };
            this.isLoggedIn = true;
            return;
        }

        if (!this.username || !this.password) {
            const interactiveCreds = await this._promptForCredentials();
            if (interactiveCreds) {
                this.username = interactiveCreds.username;
                this.password = interactiveCreds.password;
            }
        }

        if (this.username && this.password) {
            await this._performLogin(this.username, this.password);
        } else {
            logger.error('Robinhood credentials missing and interactive prompt unavailable.');
        }
    }

    async _ensureDeviceToken() {
        if (process.env.ROBINHOOD_DEVICE_TOKEN) {
            this.deviceToken = process.env.ROBINHOOD_DEVICE_TOKEN;
            return;
        }
        try {
            const data = await fs.readFile(this.deviceTokenFile, 'utf8');
            const saved = JSON.parse(data);
            if (saved.device_token) {
                this.deviceToken = saved.device_token;
                return;
            }
        } catch {}

        this.deviceToken = randomUUID();
        await fs.writeFile(
            this.deviceTokenFile,
            JSON.stringify({ device_token: this.deviceToken }, null, 2),
            'utf8'
        );
        logger.info(`Generated new Robinhood device token (${this.deviceToken}).`);
    }

    async _loadSavedToken() {
        try {
            const data = await fs.readFile(this.tokenFile, 'utf8');
            const saved = JSON.parse(data);
            if (saved.token && (!saved.expires_at || new Date(saved.expires_at) > new Date())) {
                this.token = saved.token;
                return saved.token;
            }
            logger.warn('Saved Robinhood token expired, prompting for login...');
        } catch {}
        return null;
    }

    async _requireAccessToken() {
        if (this.token) {
            return true;
        }

        const saved = await this._loadSavedToken();
        if (saved) {
            return true;
        }

        if (this.username && this.password) {
            await this._performLogin(this.username, this.password);
            return !!this.token;
        }

        throw new Error(
            'No Robinhood access token available. Set ACCESS_TOKEN or provide credentials in .env.'
        );
    }

    async _saveToken({ token, refresh_token, expires_at }) {
        const payload = {
            token,
            refresh_token: refresh_token || null,
            expires_at: expires_at ? expires_at.toISOString() : null
        };
        const data = JSON.stringify(payload, null, 2);
        await fs.writeFile(this.tokenFile, data, 'utf8');
        this.token = token;
    }

    _authHeaders(additional = {}) {
        if (!this.token) throw new Error('Missing Robinhood access token.');
        return {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...additional
        };
    }

    async _authFetch(url, { method = 'GET', headers = {}, body } = {}) {
        await this._requireAccessToken();
        const response = await fetch(url, {
            method,
            headers: this._authHeaders(headers),
            body
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Robinhood API ${response.status}: ${text}`);
        }
        return await response.json();
    }

    async _publicFetch(url, { method = 'GET', headers = {}, body } = {}) {
        const response = await fetch(url, {
            method,
            headers: {
                Accept: 'application/json',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
                ...headers
            },
            body
        });

        const rawText = await response.text();

        if (!response.ok) {
            throw new Error(`Robinhood public API ${response.status}: ${rawText}`);
        }

        if (!rawText) {
            return {};
        }

        try {
            return JSON.parse(rawText);
        } catch (error) {
            logger.warn('Failed to parse Robinhood public API response as JSON', {
                url,
                error
            });
            return rawText;
        }
    }

    _shouldUseLiveData() {
        return !this.testMode || this.useLiveMarketData;
    }

    async _requestToken({ username, password, mfa_code, challenge_id }) {
        const body = new URLSearchParams({
            grant_type: 'password',
            scope: this.oauthScope,
            client_id: this.oauthClientId,
            device_token: this.deviceToken,
            username,
            password
        });

        if (mfa_code) body.append('mfa_code', mfa_code);
        if (challenge_id) body.append('challenge_id', challenge_id);

        const response = await fetch(this.oauthTokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });

        let data = {};
        let rawText = '';
        try {
            rawText = await response.text();
            data = rawText ? JSON.parse(rawText) : {};
        } catch (error) {
            logger.error('Failed to parse token response JSON:', error);
            data = { raw: rawText };
        }

        data.status = response.status;

        const headerChallenge =
            response.headers.get('x-robinhood-challenge') ||
            response.headers.get('x-robinhood-challenge-id');
        if (headerChallenge) {
            data.challenge_id = data.challenge_id || headerChallenge;
        }

        return data;
    }

    async _handleTokenChallenges(tokenResponse, { username, password }) {
        if (tokenResponse?.access_token) {
            return tokenResponse;
        }

        const detail = tokenResponse?.detail || '';

        if (tokenResponse?.mfa_required || /mfa/i.test(detail)) {
            const mfaCode = await this._promptForMfaCode('Enter Robinhood MFA code: ');
            if (!mfaCode) throw new Error('MFA code required but not provided.');
            return await this._requestToken({ username, password, mfa_code: mfaCode });
        }

        if (tokenResponse?.challenge || /challenge/i.test(detail) || tokenResponse?.challenge_id) {
            const challenge = tokenResponse.challenge;
            const challengeId =
                challenge?.id || tokenResponse?.challenge_id || tokenResponse?.challenge?.uuid;
            const method = challenge?.type || challenge?.method || 'sms';
            if (!challengeId) throw new Error('Challenge ID missing from response.');
            const code = await this._promptForMfaCode(
                `Enter Robinhood challenge code (${method}): `
            );
            if (!code) throw new Error('Challenge response required.');
            await this._respondToChallenge(challengeId, code);
            return await this._requestToken({ username, password, challenge_id: challengeId });
        }

        if (tokenResponse?.status && tokenResponse?.detail) {
            throw new Error(tokenResponse.detail);
        }

        return tokenResponse;
    }

    async _respondToChallenge(challengeId, code) {
        const response = await fetch(this.oauthChallengeUrl(challengeId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: code })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(
                `Failed to respond to challenge (${response.status}): ${JSON.stringify(data)}`
            );
        }
    }

    async _finalizeAuth(tokenData) {
        const token = tokenData.access_token;
        const expiresIn = tokenData.expires_in ? tokenData.expires_in * 1000 : this.tokenTtlMs;
        const expires_at = new Date(Date.now() + expiresIn);
        this.client.session = { headers: { Authorization: `Bearer ${token}` } };
        this.isLoggedIn = true;
        await this._saveToken({
            token,
            refresh_token: tokenData.refresh_token,
            expires_at
        });
        logger.info(`Robinhood login successful. Token cached until ${expires_at.toISOString()}`);
    }

    async _performLogin(username, password) {
        try {
            let tokenResponse = await this._requestToken({ username, password });
            tokenResponse = await this._handleTokenChallenges(tokenResponse, { username, password });

            if (!tokenResponse?.access_token) {
                const detail = tokenResponse?.detail || 'Unknown error';
                logger.error('Raw token response:', JSON.stringify(tokenResponse, null, 2));
                throw new Error(`Robinhood login failed: ${detail}`);
            }

            await this._finalizeAuth(tokenResponse);
            return true;
        } catch (error) {
            logger.error('Login failed:', error);
            if (error?.additionalInfo) {
                logger.error('API details:', error.additionalInfo);
            }
            return false;
        }
    }

    async _promptForCredentials() {
        if (!process.stdin.isTTY) {
            return null;
        }
        const rl = readline.createInterface({ input, output });
        try {
            const username = (await rl.question('Robinhood Username: ')).trim();
            const password = await rl.question('Robinhood Password (input visible): ');
            if (!username || !password) {
                logger.error('Username and password are required.');
                return null;
            }
            return { username, password };
        } catch (error) {
            logger.error('Unable to read Robinhood credentials:', error);
            return null;
        } finally {
            rl.close();
        }
    }

    async _promptForMfaCode(promptLabel = 'Enter Robinhood MFA code: ') {
        if (!process.stdin.isTTY) {
            return null;
        }
        const rl = readline.createInterface({ input, output });
        try {
            const code = (await rl.question(promptLabel)).trim();
            return code || null;
        } catch (error) {
            logger.error('Unable to read MFA code:', error);
            return null;
        } finally {
            rl.close();
        }
    }

    _isMfaRequired(error) {
        const message = error?.message || '';
        return (
            error?.code === 'E_MFA' ||
            /mfa/i.test(message) ||
            /two[- ]factor/i.test(message) ||
            /challenge/i.test(message)
        );
    }

    async manualLogin() {
        const creds = await this._promptForCredentials();
        if (!creds) {
            logger.error('Manual login aborted.');
            return false;
        }
        return await this._performLogin(creds.username, creds.password);
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
        return await this._requireAccessToken();
    }

    async getQuote(symbol) {
        if (!this._shouldUseLiveData()) {
            const price = 500 + Math.random() * 50;
            await prisma.priceSnapshot.create({
                data: { symbol, source: 'robinhood_simulator', price, recordedAt: new Date() }
            });
            return { symbol, last_trade_price: price.toFixed(2) };
        }
        const data = await this._publicFetch(`https://api.robinhood.com/quotes/${symbol}/`);
        return data;
    }

    async getHistoricalPrices(
        symbol,
        intervalOrOptions = { interval: '5minute', span: 'day' },
        legacySpan = 'day'
    ) {
        let options = {};
        if (typeof intervalOrOptions === 'string') {
            options.interval = intervalOrOptions;
            options.span = legacySpan;
        } else {
            options = intervalOrOptions || {};
        }

        const {
            interval = '5minute',
            span = 'day',
            bounds = options.bounds || 'regular',
            includeExtended = options.includeExtended ?? false,
            fetchAll = options.fetchAll ?? false,
            limit = options.limit
        } = options;

        if (!this._shouldUseLiveData()) {
            const now = Date.now();
            const samples = Array.from({ length: 12 }, (_, i) => ({
                begins_at: new Date(now - i * 5 * 60 * 1000),
                close_price: (500 + Math.random() * 50).toFixed(2)
            })).reverse();
            return limit ? samples.slice(-limit) : samples;
        }

        const params = new URLSearchParams({
            interval,
            span,
            bounds
        });
        if (includeExtended) params.set('include_extended', 'true');

        let url = `https://api.robinhood.com/quotes/historicals/${symbol}/?${params.toString()}`;
        const aggregated = [];

        while (url) {
            const data = await this._publicFetch(url);
            const chunk = data.results || data.historicals || [];
            aggregated.push(...chunk);

            if (!fetchAll || !data.next) {
                break;
            }

            if (limit && aggregated.length >= limit) {
                break;
            }

            url = data.next;
        }

        if (limit && aggregated.length > limit) {
            return aggregated.slice(-limit);
        }
        return aggregated;
    }

    async getOptionData(symbol, strikePrice, optionType, expirationDate) {
        if (!optionType) {
            throw new Error('optionType is required (CALL or PUT) to fetch option data');
        }

        if (!this._shouldUseLiveData()) {
            const price = 2.0 + Math.random() * 1.5;
            return {
                symbol: `${symbol}${strikePrice}${optionType}`,
                strike_price: strikePrice,
                expiration_date: expirationDate ?? new Date().toISOString().split('T')[0],
                type: optionType,
                price: parseFloat(price.toFixed(2)),
                mark_price: parseFloat(price.toFixed(2)),
                bid: parseFloat((price - 0.1).toFixed(2)),
                ask: parseFloat((price + 0.1).toFixed(2)),
                instrument_id: null,
                instrument_url: null,
                chain_id: null,
                updated_at: new Date().toISOString()
            };
        }

        const privateFetch = this._authFetch.bind(this);
        const instrumentData = await privateFetch(
            `https://api.robinhood.com/instruments/?symbol=${symbol}`
        );
        const instrument =
            instrumentData.results?.find((i) => i.symbol?.toUpperCase() === symbol.toUpperCase()) ??
            instrumentData.results?.[0];

        const chainQuery = instrument?.id
            ? `equity_instrument_ids=${instrument.id}`
            : `symbol=${symbol}`;

        const chainData = await privateFetch(
            `https://api.robinhood.com/options/chains/?${chainQuery}`
        );
        const chain =
            chainData.results?.find((c) => c.symbol?.toUpperCase() === symbol.toUpperCase()) ??
            chainData.results?.[0];
        if (!chain) {
            throw new Error(`No option chain found for ${symbol}`);
        }

        let resolvedExpiration = expirationDate;
        const today = new Date().toISOString().split('T')[0];
        if (!resolvedExpiration) {
            resolvedExpiration =
                chain.expiration_dates?.find((date) => date >= today) ??
                chain.expiration_dates?.[0];
        }
        if (!resolvedExpiration) {
            throw new Error(`No expiration dates available for ${symbol}`);
        }

        const params = new URLSearchParams({
            chain_id: chain.id,
            expiration_dates: resolvedExpiration,
            strike_price: strikePrice,
            type: optionType.toLowerCase()
        });

        const instrumentsUrl = `https://api.robinhood.com/options/instruments/?${params.toString()}`;
        let optionsData = await privateFetch(instrumentsUrl);

        const findMatch = (list = []) =>
            list.find(
                (opt) =>
                    parseFloat(opt.strike_price) === parseFloat(strikePrice) &&
                    opt.expiration_date === resolvedExpiration
            );

        let match = findMatch(optionsData.results);

        let safetyCounter = 0;
        let nextUrl = optionsData.next;
        while (!match && nextUrl && safetyCounter < 25) {
            optionsData = await privateFetch(nextUrl);
            match = findMatch(optionsData.results);
            nextUrl = optionsData.next;
            safetyCounter += 1;
        }

        if (!match && optionsData.results?.length) {
            match = optionsData.results[0];
        }

        if (!match) {
            logger.warn(
                `No option instrument matched ${symbol} ${strikePrice}${optionType} ${resolvedExpiration}, falling back to synthetic quote.`
            );
            return await this._synthesizeOptionData(symbol, strikePrice, optionType, resolvedExpiration);
        }

        const quoteResponse = await privateFetch(
            `https://api.robinhood.com/marketdata/options/?instruments=${encodeURIComponent(match.url)}`
        );
        const quote = quoteResponse.results?.[0];

        if (!quote) {
            logger.warn(
                `Option instrument found but quote missing for ${symbol} ${strikePrice}${optionType} ${resolvedExpiration}, falling back to synthetic quote.`
            );
            return await this._synthesizeOptionData(symbol, strikePrice, optionType, resolvedExpiration);
        }

        const bidPriceRaw = parseFloat(quote.bid_price ?? match.bid_price ?? 'NaN');
        const askPriceRaw = parseFloat(quote.ask_price ?? match.ask_price ?? 'NaN');
        const bidPrice = Number.isFinite(bidPriceRaw) ? bidPriceRaw : null;
        const askPrice = Number.isFinite(askPriceRaw) ? askPriceRaw : null;

        const markPriceSource =
            quote.adjusted_mark_price ??
            quote.mark_price ??
            quote.last_trade_price ??
            (bidPrice ?? undefined) ??
            (askPrice ?? undefined);
        const markPriceParsed = parseFloat(markPriceSource ?? 'NaN');
        const markPrice = Number.isFinite(markPriceParsed)
            ? markPriceParsed
            : bidPrice ?? askPrice ?? 0;

        const snapshotSymbol =
            match.symbol ||
            match.chain_symbol ||
            `${symbol.toUpperCase()}${strikePrice}${optionType.toUpperCase()}`;

        await prisma.priceSnapshot.create({
            data: {
                symbol: snapshotSymbol,
                source: 'robinhood_api',
                price: markPrice,
                metadata: JSON.stringify({ quote, instrument: match }),
                recordedAt: new Date()
            }
        });

        return {
            symbol: snapshotSymbol,
            strike_price: parseFloat(match.strike_price),
            expiration_date: match.expiration_date,
            type: match.type?.toUpperCase(),
            price: markPrice,
            mark_price: markPrice,
            bid: bidPrice,
            ask: askPrice,
            instrument_id: match.id,
            instrument_url: match.url,
            chain_id: match.chain_id || chain.id,
            updated_at:
                quote.updated_at ||
                quote.mark_price_updated_at ||
                match.updated_at ||
                new Date().toISOString()
        };
    }

    async _synthesizeOptionData(symbol, strikePrice, optionType, expirationDate) {
        const quote = await this.getQuote(symbol);
        const underlying = parseFloat(
            quote.last_trade_price || quote.last_extended_hours_trade_price || 0
        );
        const intrinsic =
            optionType.toUpperCase() === 'CALL'
                ? Math.max(underlying - strikePrice, 0)
                : Math.max(strikePrice - underlying, 0);
        const syntheticPrice = parseFloat((intrinsic + 0.5).toFixed(2));
        const bid = parseFloat(Math.max(syntheticPrice - 0.2, 0).toFixed(2));
        const ask = parseFloat((syntheticPrice + 0.2).toFixed(2));
        return {
            symbol: `${symbol}${strikePrice}${optionType}`,
            strike_price: strikePrice,
            expiration_date: expirationDate,
            type: optionType,
            price: syntheticPrice,
            mark_price: syntheticPrice,
            bid,
            ask,
            instrument_id: null,
            instrument_url: null,
            chain_id: null,
            updated_at: new Date().toISOString()
        };
    }

    async simulateExitPrice(entryPrice) {
        const movement = (Math.random() - 0.5) * 0.4;
        const exitPrice = parseFloat((entryPrice * (1 + movement)).toFixed(2));
        logger.info(`[SIMULATED EXIT] $${entryPrice.toFixed(2)} → $${exitPrice}`);
        return exitPrice;
    }

    async getExitPrice(symbol, strikePrice, optionType, expirationDate, entryPrice) {
        if (!this._shouldUseLiveData()) {
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

            logger.info(`[REAL EXIT] ${symbol} ${strikePrice}${optionType} → $${price.toFixed(2)}`);
            return parseFloat(price.toFixed(2));
        } catch (error) {
            logger.error('[ERROR] getExitPrice:', error);
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
        if (!this._shouldUseLiveData()) {
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
        const data = await this._authFetch('https://api.robinhood.com/accounts/');
        return data.results?.[0];
    }

    async getPositions() {
        if (!this._shouldUseLiveData()) {
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
        return await this._authFetch('https://api.robinhood.com/positions/?nonzero=true');
    }

    async getOrderHistory() {
        if (!this._shouldUseLiveData()) {
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
        return await this._authFetch('https://api.robinhood.com/orders/');
    }
}

// ✅ Export singleton
export default new RobinhoodService();
