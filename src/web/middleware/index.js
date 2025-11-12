import express from 'express';
import { configureHelmet, configureCors, configureRateLimit } from './security.js';
import { requestLogger, errorHandler } from './logging.js';
import { authenticateWrite, authenticateAdmin, validateApiKey, validateAdmin } from './auth.js';

// Export authentication middleware for use in routes
export { validateApiKey, validateAdmin };

/**
 * Setup all middleware for the Express application
 * @param {Object} app - Express application instance
 */
export const setupMiddleware = (app) => {
    // Security middleware
    app.use(configureHelmet());
    app.use(configureCors());
    app.use(configureRateLimit());

    // Body parsing
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Authentication
    app.use(authenticateWrite);
    app.use('/admin', authenticateAdmin);

    // Request logging
    app.use(requestLogger);

    // Error handling
    app.use(errorHandler);
}; 