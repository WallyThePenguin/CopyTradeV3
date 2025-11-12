import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

// WebSocket server instance
let wss = null;

// Initialize WebSocket server
export function initializeWebSocket(server) {
    if (wss) {
        logger.warn('WebSocket server already initialized');
        return;
    }

    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        logger.info('New WebSocket client connected');

        ws.on('close', () => {
            logger.info('WebSocket client disconnected');
        });

        ws.on('error', (error) => {
            logger.error('WebSocket error:', error);
        });
    });

    logger.info('WebSocket server initialized');
}

// Broadcast a signal to all connected clients
export function broadcastSignal(type, data) {
    if (!wss) {
        logger.error('WebSocket server not initialized');
        return;
    }

    const message = JSON.stringify({ type, data });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Get the WebSocket server instance
export function getWebSocketServer() {
    return wss;
}

// Check if WebSocket server is initialized
export function isWebSocketInitialized() {
    return wss !== null;
} 