import { broadcastSignal } from './websocket.js';

// Helper functions for different types of updates
export function broadcastTradeUpdate(trade) {
    if (trade.status === 'OPEN') {
        broadcastSignal('trade_opened', trade);
    } else if (trade.status === 'CLOSED') {
        broadcastSignal('trade_closed', trade);
    }
}

export function broadcastTradeSignal(signal) {
    broadcastSignal('trade_signal', signal);
}

export function broadcastChannelMetrics(channelId, metrics) {
    broadcastSignal('metrics_update', { channelId, ...metrics });
}

export function broadcastPerformanceUpdate(performance) {
    broadcastSignal('performance_update', performance);
}

export function broadcastMarketUpdate(update) {
    broadcastSignal('market_update', update);
}

export function broadcastTraderStats(stats) {
    broadcastSignal('trader_stats_update', stats);
}

export function broadcastBotStats(stats) {
    broadcastSignal('bot_stats_update', stats);
} 