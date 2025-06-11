import { WebhookClient, MessageEmbed } from 'discord.js-selfbot-v13';

/**
 * Send a trade signal webhook with Discord embed
 * @param {string} webhookUrl - The webhook URL
 * @param {Object} data - Trade signal data
 */
export async function sendTradeSignalWebhook(webhookUrl, data) {
    const { trade, analysis, channelConfig, message, source = 'Discord' } = data;

    try {
        const webhook = new WebhookClient({ url: webhookUrl });

        const embed = new MessageEmbed()
            .setTitle('🎯 Trade Signal Detected')
            .setColor(getColorForAction(analysis.action))
            .setTimestamp()
            .setFooter({
                text: `Channel: ${channelConfig.name}`,
                iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
            });

        embed.addField('Symbol', `**${analysis.symbol}**`, true);
        embed.addField('Action', `${getActionEmoji(analysis.action)} ${analysis.action}`, true);
        embed.addField('Confidence', `${(analysis.confidence * 100).toFixed(1)}%`, true);

        if (analysis.optionType) {
            embed.addField('Option Type', analysis.optionType, true);
            embed.addField('Strike Price', `$${analysis.strikePrice}`, true);
        }

        embed.addField('Entry Price', trade?.entryPrice ? `$${trade.entryPrice.toFixed(2)}` : 'Market Order', true);
        embed.addField('Quantity', `${trade?.quantity || 1}`, true);
        embed.addField('Signal Type', analysis.signalType || 'ENTRY', true);
        embed.addField('Trader', message.author.username, true);
        embed.addField('Time', new Date().toLocaleTimeString(), true);
        embed.addField('Source', source, true);

        embed.addField('Original Message', `\`\`\`${message.content.substring(0, 1000)}\`\`\``);

        const description = generateTradeDescription(analysis, channelConfig);
        if (description) embed.setDescription(description);

        await webhook.send({
            username: 'Trade Signal Bot',
            avatarURL: 'https://cdn.discordapp.com/embed/avatars/4.png',
            embeds: [embed]
        });

    } catch (error) {
        console.error('Error sending webhook:', error);
        throw error;
    }
}



/**
 * Send an exit signal webhook
 * @param {string} webhookUrl - The webhook URL
 * @param {Object} data - Exit signal data
 */
export async function sendExitSignalWebhook(webhookUrl, data) {
    const { trade, analysis, channelConfig, message, profitLoss, source = 'Discord' } = data;

    try {
        const webhook = new WebhookClient({ url: webhookUrl });

        const result =
            profitLoss > 0 ? '✅ WIN' :
            profitLoss < 0 ? '❌ LOSS' :
            '➖ BREAKEVEN';

        const embed = new MessageEmbed()
            .setTitle('🚪 Exit Signal Detected')
            .setColor(profitLoss > 0 ? '#00ff00' : (profitLoss < 0 ? '#ff0000' : '#999999'))
            .setTimestamp()
            .setFooter({
                text: `Channel: ${channelConfig.name}`,
                iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
            });

        embed.addField('Symbol', `**${trade.symbol}**`, true);
        embed.addField('Action', '📤 EXIT', true);
        embed.addField('P&L', formatProfitLoss(profitLoss), true);
        embed.addField('Result', result, true);

        if (trade.optionType) {
            embed.addField('Option Type', trade.optionType, true);
            embed.addField('Strike Price', `$${trade.strikePrice}`, true);
        }

        embed.addField('Entry Price', trade.entryPrice ? `$${trade.entryPrice.toFixed(2)}` : 'N/A', true);
        embed.addField('Exit Price', analysis.exitPrice ? `$${analysis.exitPrice.toFixed(2)}` : 'Market Order', true);

        const duration = trade.entryTime ? formatDuration(new Date(trade.entryTime), new Date()) : 'N/A';
        embed.addField('Hold Duration', duration, true);

        embed.addField('Quantity', `${trade.quantity || 1}`, true);
        embed.addField('Trade ID', trade.id || 'N/A', true);
        embed.addField('Trader', message.author.username, true);
        embed.addField('Source', source, true);

        embed.addField('Original Message', `\`\`\`${message.content.substring(0, 1000)}\`\`\``);

        await webhook.send({
            username: 'Trade Signal Bot',
            avatarURL: 'https://cdn.discordapp.com/embed/avatars/4.png',
            embeds: [embed]
        });

    } catch (error) {
        console.error('Error sending exit webhook:', error);
        throw error;
    }
}



/**
 * Send a performance update webhook
 * @param {string} webhookUrl - The webhook URL
 * @param {Object} stats - Performance statistics
 */
export async function sendPerformanceWebhook(webhookUrl, stats) {
    try {
        const webhook = new WebhookClient({ url: webhookUrl });
        
        const embed = new MessageEmbed()
            .setTitle('📊 Daily Performance Update')
            .setColor('#0099ff')
            .setTimestamp()
            .setDescription('Your trading performance for today');

        embed.addField('Total Trades', stats.totalTrades.toString(), true);
        embed.addField('Win Rate', `${(stats.winRate * 100).toFixed(1)}%`, true);
        embed.addField('Total P&L', formatProfitLoss(stats.totalPL), true);

        embed.addField('Best Trade', stats.bestTrade ? `${stats.bestTrade.symbol} +${stats.bestTrade.profitLoss}` : 'N/A', true);
        embed.addField('Worst Trade', stats.worstTrade ? `${stats.worstTrade.symbol} ${stats.worstTrade.profitLoss}` : 'N/A', true);
        embed.addField('Avg Trade Duration', formatDuration(0, stats.avgTradeDuration * 60 * 1000), true);

        if (stats.topSymbols && stats.topSymbols.length > 0) {
            const symbolList = stats.topSymbols.map(s => `${s.symbol}: ${s.count} trades`).join('\n');
            embed.addField('Most Traded Symbols', symbolList);
        }

        await webhook.send({
            username: 'Performance Bot',
            avatarURL: 'https://cdn.discordapp.com/embed/avatars/3.png',
            embeds: [embed]
        });

    } catch (error) {
        console.error('Error sending performance webhook:', error);
        throw error;
    }
}

// Helper functions
function getColorForAction(action) {
    switch (action.toUpperCase()) {
        case 'BUY':
            return '#00ff00'; // Green
        case 'SELL':
            return '#ff0000'; // Red
        case 'HOLD':
            return '#ffff00'; // Yellow
        default:
            return '#0099ff'; // Blue
    }
}

function getActionEmoji(action) {
    switch (action.toUpperCase()) {
        case 'BUY':
            return '📈';
        case 'SELL':
            return '📉';
        case 'HOLD':
            return '⏸️';
        default:
            return '📊';
    }
}

function formatProfitLoss(pl) {
    if (pl > 0) {
        return `+$${pl.toFixed(2)} 💰`;
    } else if (pl < 0) {
        return `-$${Math.abs(pl).toFixed(2)} 💸`;
    } else {
        return '$0.00 ➖';
    }
}

function formatDuration(startTime, endTime) {
    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function generateTradeDescription(analysis, channelConfig) {
    const parts = [];
    
    // Risk level assessment
    if (channelConfig.riskLevel) {
        parts.push(`⚠️ Risk Level: ${channelConfig.riskLevel}`);
    }
    
    // Confidence assessment
    if (analysis.confidence >= 0.9) {
        parts.push('🎯 High confidence signal');
    } else if (analysis.confidence >= 0.8) {
        parts.push('✅ Good confidence signal');
    } else {
        parts.push('⚡ Moderate confidence signal');
    }
    
    // Position size recommendation
    if (channelConfig.max_position_size) {
        const recommendedSize = Math.floor(channelConfig.max_position_size * analysis.confidence);
        parts.push(`💵 Recommended position: $${recommendedSize}`);
    }
    
    return parts.join('\n');
}

export default {
    sendTradeSignalWebhook,
    sendExitSignalWebhook,
    sendPerformanceWebhook
};