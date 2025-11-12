import { logger } from '../../utils/logger.js';

/**
 * API Key validation middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_KEY) {
        logger.warn('Invalid API key attempt');
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
};

/**
 * Admin validation middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        logger.warn('Invalid admin key attempt');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

/**
 * Write operation authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateWrite = (req, res, next) => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY || !['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        return next();
    }
    const key = req.headers['x-api-key'];
    if (key && key === API_KEY) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

/**
 * Admin authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateAdmin = (req, res, next) => {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
        return next();
    }
    const pass = req.headers['x-admin-password'];
    if (pass && pass === ADMIN_PASSWORD) {
        return next();
    }
    res.status(401).json({ error: 'Admin Unauthorized' });
};