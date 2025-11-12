import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { validateEnv } from '../utils/validateEnv.js';
import { logger } from '../utils/logger.js';
import { initializeTradingService } from '../services/tradingService.js';
import routes from './routes/index.js';
import { setupMiddleware } from './middleware/index.js';
import { setupCronJobs } from './cron.js';
import { WebSocketServer } from 'ws';
import { errorHandlerMiddleware } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize and configure the Express application
 * @returns {Object} Express app and server
 */
function initializeApp() {
    // Validate environment variables
    if (!validateEnv()) {
        logger.error('Environment validation failed');
        process.exit(1);
    }

    // Initialize Express app
    const app = express();
    const prisma = new PrismaClient();

    // Create HTTP server (instead of HTTPS)
    const server = http.createServer(app);

    return { app, server, prisma };
}

/**
 * Configure WebSocket server
 * @param {Object} server - HTTP server
 * @returns {Object} WebSocket server
 */
function configureWebSocket(server) {
    // WebSocket server for /ws/signals
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws) => {
        logger.info('New WebSocket client connected');
        ws.on('close', () => {
            logger.info('WebSocket client disconnected');
        });
        ws.on('error', (error) => {
            logger.error('WebSocket error:', error);
        });
    });

    server.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws/signals') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    return wss;
}

/**
 * Configure routes for the Express application
 * @param {Object} app - Express application
 */
function configureRoutes(app) {
    // Disable caching for API routes
    app.use('/api', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });

    // Setup routes
    app.use('/api', routes);

    // Direct test route for API
    app.get('/api/test', (req, res) => {
        res.json({ message: 'API test route works!' });
    });

    // Serve static files from the dist directory
    app.use(express.static(path.join(__dirname, '../../dist')));

    // Serve index.html for all other routes (SPA support)
    app.get('*', (req, res) => {
        logger.debug('CATCH-ALL ROUTE HIT:', req.originalUrl);
        res.sendFile(path.join(__dirname, '../../dist/index.html'));
    });

    // Add error handler middleware as the last middleware
    app.use(errorHandlerMiddleware);
}

/**
 * Start the server and initialize services
 * @param {Object} server - HTTP server
 */
function startServer(server) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        logger.info(`Server running on HTTP port ${PORT}`);

        // Initialize trading service
        initializeTradingService().catch(error => {
            logger.error('Failed to initialize trading service:', error);
            process.exit(1);
        });

        // Setup cron jobs
        setupCronJobs();

        logger.info('=== SERVER STARTED (HTTP) ===');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received. Closing HTTP server...');
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    });
}

// Main application initialization
const { app, server, prisma } = initializeApp();
const wss = configureWebSocket(server);

// Setup middleware
setupMiddleware(app);

// Configure routes
configureRoutes(app);

// Start the server
startServer(server);

// Export for use in other modules
export { app, server, wss, prisma };