import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

/**
 * Configure and return helmet middleware
 * @returns {Function} Helmet middleware
 */
export const configureHelmet = () => {
    return helmet();
};

/**
 * Configure and return CORS middleware
 * @returns {Function} CORS middleware
 */
export const configureCors = () => {
    // Allow multiple origins for development and production
    const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000',
        'http://localhost:5173',
        'https://localhost:5173',
        'http://validtesting.tplinkdns.com',
        'https://validtesting.tplinkdns.com'
    ].filter(Boolean); // Remove undefined/null values
    
    return cors({
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps, curl, etc.)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true, // Allow cookies to be sent with requests
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'x-api-key', 'x-admin-key', 'Authorization']
    });
};

/**
 * Configure and return rate limiting middleware
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum number of requests per window
 * @returns {Function} Rate limiting middleware
 */
export const configureRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
    return rateLimit({
        windowMs,
        max,
        message: 'Too many requests from this IP, please try again later'
    });
};
