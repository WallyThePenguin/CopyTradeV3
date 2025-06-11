import { Client, WebhookClient } from 'discord.js-selfbot-v13';
import { mistralService } from './services/mistral.js';
import { tradeTracker } from './services/tradeTracker.js';
import { logger } from './utils/logger.js';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import './web/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Discord client
const client = new Client({
    checkUpdate: false
});

// Initialize message queues with max size
const MAX_QUEUE_SIZE = 1000;
const shortformQueue = [];
const longformQueue = [];

// Initialize channels configuration
let channels = {
    shortform: [],
    longform: []
};

// Initialize Mistral model at startup
let mistralInitialized = false;
async function initializeMistral() {
    try {
        await mistralService.initialize();
        mistralInitialized = true;
        logger.info('Mistral model initialized');
    } catch (error) {
        logger.error('Failed to initialize Mistral model', error);
        process.exit(1); // Exit if we can't initialize the model
    }
}

// Set up hot-reloading for channel configuration
const configPath = path.join(__dirname, 'config', 'channels.js');
chokidar.watch(configPath).on('change', async () => {
    logger.info('Channel configuration updated, reloading...');
    try {
        const { channels: newChannels } = await import('./config/channels.js');
        channels = newChannels;
        logger.info('Channel configuration reloaded successfully');
    } catch (error) {
        logger.error('Error reloading channel configuration', error);
    }
});

// Load initial channel configuration
(async () => {
    try {
        const { channels: initialChannels } = await import('./config/channels.js');
        channels = initialChannels;
        logger.info('Initial channel configuration loaded successfully');

        // Insert channels into the database if they do not exist
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const allChannels = [
            ...channels.shortform.map(c => ({ ...c, type: 'shortform' })),
            ...channels.longform.map(c => ({ ...c, type: 'longform' }))
        ];
        for (const ch of allChannels) {
            await prisma.channel.upsert({
                where: { id: ch.id },
                update: {},
                create: {
                    id: ch.id,
                    name: ch.name,
                    type: ch.type,
                    enabled: ch.enabled ?? true,
                    minConfidence: ch.min_confidence ?? 0.8,
                    maxTrades: ch.max_position_size ?? 5,
                    riskLevel: 'MEDIUM',
                    webhook_url: ch.webhook_url ?? null
                }
            });
        }
        await prisma.$disconnect();
        logger.info('Channels inserted/verified in database');
    } catch (error) {
        logger.error('Error loading initial channel configuration', error);
    }
})();

// Process messages from queues
async function processMessage(message, isShortform = true) {
    if (!mistralInitialized) {
        logger.error('Mistral model not initialized');
        return;
    }

    try {
        // Get channel configuration for this message
        const channelConfig = channels.shortform.find(c => c.id === message.channel.id) ||
            channels.longform.find(c => c.id === message.channel.id);

        // Analyze message with Mistral
        const analysis = await mistralService.analyzeMessage(message.content);

        // If trade signal detected
        if (analysis.isTradeSignal) {
            // Track the trade
        const trade = await tradeTracker.trackTrade({
            symbol: analysis.symbol,
            action: analysis.action,
            optionType: analysis.optionType,
            strikePrice: analysis.strikePrice,
            quantity: analysis.quantity || 1,
            entryPrice: analysis.entryPrice ?? null, // fallback if Python provides a price
            channelId: message.channel.id,
            channelName: channelConfig?.name || message.channel.name || 'Unknown Channel',
            channelType: channelConfig?.type || (isShortform ? 'shortform' : 'longform'),
            signalType: analysis.signalType || 'ENTRY', // make sure this is passed
            author: message.author.id,
        });

            await tradeTracker.logTradeSignal({
                tradeId: trade.id,
                confidence: analysis.confidence,
                source: 'DISCORD',
                autoExecuted: channelConfig?.enabled !== false,
                triggeredAt: new Date()
            });


            // Broadcast signal to WebSocket clients
            const { broadcastSignal } = await import('./web/server.js');
            broadcastSignal({
                symbol: analysis.symbol,
                action: analysis.action,
                optionType: analysis.optionType,
                strikePrice: analysis.strikePrice,
                entryPrice: analysis.entryPrice,
                confidence: analysis.confidence,
                signalType: analysis.signalType,
                trader: message.author.username,
                channel: channelConfig?.name || 'Unknown',
                timestamp: new Date()
            });

            // Send webhook notification with Discord embed
            if (channelConfig?.webhook_url) {
                const { sendTradeSignalWebhook } = await import('./services/webhookService.js');
                await sendTradeSignalWebhook(channelConfig.webhook_url, {
                    trade,
                    analysis,
                    channelConfig,
                    message
                });
            }
        }

        // Track message for analysis
        const msgRecord = await tradeTracker.trackMessage({
            channelId: message.channel.id,
            channelName: channelConfig?.name || message.channel.name || 'Unknown Channel',
            messageId: message.id,
            content: message.content,
            authorId: message.author.id,
            authorName: message.author.username,
            timestamp: message.createdAt,
            parsedData: analysis,
            modelUsed: 'mistral',
            parsedAt: new Date()
        });

        await tradeTracker.logModelResult({
            messageId: msgRecord.id,
            prompt: message.content,
            response: analysis,
            modelName: 'mistral'
        });

    } catch (error) {
        logger.error('Error processing message', error);
    }
}

// Set up message handlers
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Get channel configuration
    const channelConfig = channels.shortform.find(c => c.id === message.channel.id) ||
        channels.longform.find(c => c.id === message.channel.id);

    if (channelConfig) {
        const queue = channelConfig.type === 'shortform' ? shortformQueue : longformQueue;

        // Add to queue if not full
        if (queue.length < MAX_QUEUE_SIZE) {
            queue.push(message);
        } else {
            logger.warn(`Queue full for ${channelConfig.type} messages`);
        }
    }
});

// Process queues at different intervals
setInterval(() => {
    const message = shortformQueue.shift();
    if (message) {
        processMessage(message, true).catch(error => {
            logger.error('Error processing shortform message', error);
        });
    }
}, 100); // Process shortform messages every 100ms

setInterval(() => {
    const message = longformQueue.shift();
    if (message) {
        processMessage(message, false).catch(error => {
            logger.error('Error processing longform message', error);
        });
    }
}, 1000); // Process longform messages every 1000ms

// Handle client events
client.on('ready', async () => {
    logger.info(`Logged in as ${client.user.tag}`);
    // Initialize Mistral after Discord client is ready
    await initializeMistral();
});

client.on('error', (error) => {
    logger.error('Discord client error', error);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Error logging in', error);
    process.exit(1);
}); 