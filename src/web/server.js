import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import fs from 'fs';
import { validateEnv } from '../utils/validateEnv.js';
import { logger } from '../utils/logger.js';
import { initializeTradingService } from '../services/tradingService.js';
import routes from './routes/index.js';
import { setupMiddleware } from './middleware/index.js';
import { setupCronJobs } from './cron.js';
import { errorHandlerMiddleware } from '../utils/errors.js';
import { initializeWebSocket, broadcastSignal as websocketBroadcast } from './websocket.js';

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

    // Create HTTPS server
    const options = {
        key: fs.readFileSync('server.key'),
        cert: fs.readFileSync('server.cert')
    };
    const server = https.createServer(options, app);

    return { app, server, prisma };
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
 * @param {Object} server - HTTPS server
 */
function startServer(server) {
    const PORT = process.env.PORT || 5000;
    
    // Add error handler for server
    server.on('error', (e) => {
        logger.error('Server error:', e);
        if (e.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is already in use. Please use a different port.`);
            process.exit(1);
        }
    });
    
    server.listen(PORT, () => {
        logger.info(`Server running on HTTPS port ${PORT}`);
        logger.info(`Access the application at: https://validtesting.tplinkdns.com:${PORT}`);
        logger.info(`For local development: https://localhost:${PORT}`);

        // Initialize trading service
        initializeTradingService().catch(error => {
            logger.error('Failed to initialize trading service:', error);
            process.exit(1);
        });

        // Setup cron jobs
        setupCronJobs();

        logger.info('=== SERVER STARTED ===');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received. Closing HTTPS server...');
        server.close(() => {
            logger.info('HTTPS server closed');
            process.exit(0);
        });
    });
    
    process.on('SIGINT', async () => {
        logger.info('SIGINT received. Closing HTTPS server...');
        server.close(() => {
            logger.info('HTTPS server closed');
            process.exit(0);
        });
    });
}

// Check if this file is being run directly or imported
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

// Main application initialization
const { app, server, prisma } = initializeApp();
initializeWebSocket(server);

// Setup middleware
setupMiddleware(app);

// Configure routes
configureRoutes(app);

// Only start the server if this file is run directly
if (isDirectRun) {
    startServer(server);
}

// Function to broadcast signals to WebSocket clients
export const broadcastSignal = websocketBroadcast;

// Export for use in other modules
export { app, server, prisma };
