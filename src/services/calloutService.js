import { PrismaClient } from '@prisma/client';
import BaseService from './base/BaseService.js';
import tradingService from './tradingService.js';
import robinhoodService from './robinhood.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

function parseFloatOrNull(value) {
    const parsed = value === null || value === undefined ? null : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDateOrNull(value) {
    if (!value) return null;
    const asDate = value instanceof Date ? value : new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
}

class CalloutService extends BaseService {
    constructor() {
        super('CalloutService');
        this.prisma = prisma;
    }

    async _initializeImplementation() {
        await tradingService.initialize();
    }

    async recordDiscordCallout({ message, analysis, channelConfig }) {
        await this.initialize();
        if (!analysis?.symbol) {
            throw new Error('Cannot record callout without a symbol');
        }

        const calloutPayload = {
            source: 'DISCORD',
            sourceMessageId: message.id,
            sourceChannelId: message.channel?.id,
            channelId: message.channel?.id,
            channelName: channelConfig?.name || message.channel?.name || 'Unknown',
            traderName: message.author?.username || null,
            symbol: analysis.symbol,
            action: analysis.action,
            optionType: analysis.optionType,
            strikePrice: analysis.strikePrice,
            expirationDate: analysis.expirationDate,
            targetEntry: analysis.entryPrice,
            targetExit: analysis.exitPrice,
            quantity: analysis.quantity,
            confidence: analysis.confidence,
            assetType: analysis.optionType ? 'OPTION' : 'EQUITY',
            rawMessage: message.content,
            rawAnalysis: JSON.stringify(analysis),
            calloutAt: message.createdTimestamp
                ? new Date(message.createdTimestamp)
                : message.createdAt || new Date()
        };

        return await this._recordCallout(calloutPayload);
    }

    async recordManualCallout(payload) {
        await this.initialize();
        if (!payload?.symbol) {
            throw new Error('symbol is required for manual callouts');
        }
        return await this._recordCallout({
            ...payload,
            source: payload.source || 'MANUAL',
            channelId: payload.channelId || null,
            channelName: payload.channelName || null,
            assetType: payload.assetType || (payload.optionType ? 'OPTION' : 'EQUITY')
        });
    }

    async _recordCallout(payload) {
        const {
            source = 'UNKNOWN',
            sourceMessageId = null,
            sourceChannelId = null,
            channelId = null,
            channelName = null,
            traderName = null,
            symbol,
            action = null,
            assetType = 'EQUITY',
            strikePrice = null,
            optionType = null,
            expirationDate = null,
            targetEntry = null,
            targetExit = null,
            quantity = null,
            confidence = null,
            rawMessage = null,
            rawAnalysis = null,
            calloutAt = new Date()
        } = payload;

        const normalizedSymbol = symbol.toUpperCase();
        const normalizedOption = optionType ? optionType.toUpperCase() : null;
        const normalizedAction = action ? action.toUpperCase() : null;

        const callout = await this.prisma.callout.create({
            data: {
                source,
                sourceMessageId,
                sourceChannelId,
                channelId,
                channelName,
                traderName,
                symbol: normalizedSymbol,
                action: normalizedAction,
                assetType: normalizedOption ? 'OPTION' : assetType,
                strikePrice: parseFloatOrNull(strikePrice),
                optionType: normalizedOption,
                expirationDate: toDateOrNull(expirationDate),
                targetEntry: parseFloatOrNull(targetEntry),
                targetExit: parseFloatOrNull(targetExit),
                quantity: quantity ?? null,
                confidence: parseFloatOrNull(confidence),
                rawMessage,
                rawAnalysis,
                calloutAt: toDateOrNull(calloutAt) || new Date()
            }
        });

        let snapshotResult = null;
        try {
            snapshotResult = await this._captureInitialSnapshot(callout);
        } catch (error) {
            logger.error('Failed to capture callout snapshot', { calloutId: callout.id, error });
        }

        return {
            callout,
            snapshot: snapshotResult?.snapshot || null,
            match: snapshotResult?.match || null
        };
    }

    async _captureInitialSnapshot(callout) {
        if (!callout?.symbol) return null;
        const quoteResult = await this._fetchQuote(callout);
        if (!quoteResult?.price || Number.isNaN(quoteResult.price)) {
            return null;
        }

        const snapshot = await this.prisma.priceSnapshot.create({
            data: {
                symbol: callout.symbol,
                source: quoteResult.quoteSource,
                price: quoteResult.price,
                metadata: quoteResult.metadata,
                calloutId: callout.id,
                recordedAt: quoteResult.quoteTimestamp || new Date()
            }
        });

        const match = await this.prisma.calloutMatch.create({
            data: {
                calloutId: callout.id,
                matchType: 'CALLOUT',
                quoteSource: quoteResult.quoteSource,
                priceSnapshotId: snapshot.id,
                symbol: callout.symbol,
                referencePrice: quoteResult.price,
                bidPrice: quoteResult.bidPrice,
                askPrice: quoteResult.askPrice,
                markPrice: quoteResult.markPrice,
                instrumentId: quoteResult.instrumentId,
                quoteTimestamp: quoteResult.quoteTimestamp || new Date(),
                latencyMs: quoteResult.latencyMs || null
            }
        });

        return { snapshot, match };
    }

    async _fetchQuote(callout) {
        const startedAt = Date.now();
        if (callout.assetType === 'OPTION' || callout.optionType) {
            if (!callout.strikePrice || !callout.optionType) {
                logger.warn('Option callout missing strike or type, skipping snapshot', {
                    calloutId: callout.id
                });
                return null;
            }
            const optionQuote = await robinhoodService.getOptionData(
                callout.symbol,
                callout.strikePrice,
                callout.optionType,
                callout.expirationDate?.toISOString().split('T')[0]
            );
            return {
                quoteSource: 'robinhood_option',
                price: parseFloatOrNull(optionQuote?.price ?? optionQuote?.mark_price),
                bidPrice: parseFloatOrNull(optionQuote?.bid ?? optionQuote?.bid_price),
                askPrice: parseFloatOrNull(optionQuote?.ask ?? optionQuote?.ask_price),
                markPrice: parseFloatOrNull(optionQuote?.mark_price ?? optionQuote?.price),
                instrumentId: optionQuote?.instrument_id || optionQuote?.id || null,
                quoteTimestamp: optionQuote?.updated_at ? new Date(optionQuote.updated_at) : new Date(),
                latencyMs: Date.now() - startedAt,
                metadata: JSON.stringify(optionQuote || {})
            };
        }

        const quote = await tradingService.getQuote(callout.symbol);
        const derivedPrice = parseFloatOrNull(
            quote?.last_trade_price ??
            quote?.last_extended_hours_trade_price ??
            quote?.mark ??
            quote?.mark_price ??
            quote?.adjusted_mark_price ??
            quote?.bid_price ??
            quote?.ask_price
        );

        return {
            quoteSource: 'robinhood_equity',
            price: derivedPrice,
            bidPrice: parseFloatOrNull(quote?.bid_price),
            askPrice: parseFloatOrNull(quote?.ask_price),
            markPrice: parseFloatOrNull(quote?.mark_price ?? quote?.mark ?? derivedPrice),
            instrumentId: quote?.instrument ?? null,
            quoteTimestamp: quote?.updated_at ? new Date(quote.updated_at) : new Date(),
            latencyMs: Date.now() - startedAt,
            metadata: JSON.stringify(quote || {})
        };
    }

    async attachTrade(calloutId, tradeId) {
        await this.initialize();
        if (!calloutId || !tradeId) return null;
        try {
            const updated = await this.prisma.callout.update({
                where: { id: calloutId },
                data: {
                    status: 'MATCHED',
                    matchedAt: new Date()
                }
            });
            return updated;
        } catch (error) {
            logger.error('Failed to attach trade to callout', { calloutId, tradeId, error });
            return null;
        }
    }

    async recordTradeMatch({
        calloutId = null,
        tradeId = null,
        symbol,
        price,
        matchType = 'ENTRY',
        quoteSource = 'execution',
        metadata = {}
    }) {
        await this.initialize();
        if (!price || Number.isNaN(price)) return null;

        const snapshot = await this.prisma.priceSnapshot.create({
            data: {
                symbol,
                source: quoteSource,
                price,
                metadata: JSON.stringify(metadata || {}),
                recordedAt: new Date(),
                calloutId: calloutId || undefined,
                tradeId: tradeId || undefined
            }
        });

        if (!calloutId) {
            return { snapshot, match: null };
        }

        const match = await this.prisma.calloutMatch.create({
            data: {
                calloutId,
                matchType,
                quoteSource,
                priceSnapshotId: snapshot.id,
                symbol,
                referencePrice: price,
                bidPrice: parseFloatOrNull(metadata?.bidPrice),
                askPrice: parseFloatOrNull(metadata?.askPrice),
                markPrice: parseFloatOrNull(metadata?.markPrice || price),
                instrumentId: metadata?.instrumentId || null,
                quoteTimestamp: metadata?.quoteTimestamp
                    ? new Date(metadata.quoteTimestamp)
                    : new Date(),
                latencyMs: metadata?.latencyMs ?? null
            }
        });

        const statusUpdates = {};
        if (matchType === 'ENTRY') {
            statusUpdates.status = 'FILLED';
            statusUpdates.matchedAt = new Date();
        } else if (matchType === 'EXIT') {
            statusUpdates.status = 'CLOSED';
        }

        if (Object.keys(statusUpdates).length) {
            await this.prisma.callout.update({
                where: { id: calloutId },
                data: statusUpdates
            });
        }

        return { snapshot, match };
    }

    async listCallouts({ limit = 100, status, symbol } = {}) {
        await this.initialize();
        const where = {};
        if (status) where.status = status;
        if (symbol) where.symbol = symbol.toUpperCase();

        return await this.prisma.callout.findMany({
            where,
            orderBy: { calloutAt: 'desc' },
            take: Math.min(Math.max(Number(limit) || 50, 1), 500),
            include: {
                channel: true,
                trade: true,
                matches: {
                    orderBy: { createdAt: 'desc' }
                },
                snapshots: {
                    orderBy: { recordedAt: 'desc' }
                }
            }
        });
    }

    async getCallout(id) {
        await this.initialize();
        return await this.prisma.callout.findUnique({
            where: { id },
            include: {
                channel: true,
                trade: true,
                matches: {
                    orderBy: { createdAt: 'desc' }
                },
                snapshots: {
                    orderBy: { recordedAt: 'desc' }
                }
            }
        });
    }
}

export const calloutService = new CalloutService();
export default calloutService;
