import express from 'express';
import tradesRoutes from './v1/trades.js';
import channelsRoutes from './v1/channels.js';
import statsRoutes from './v1/stats.js';
import chartsRoutes from './v1/charts.js';
import marketRoutes from './v1/market.js';
import apiRoutes from './api.js'; // Keep for backward compatibility

const router = express.Router();

// Mount v1 API routes
router.use('/v1/trades', tradesRoutes);
router.use('/v1/channels', channelsRoutes);
router.use('/v1/stats', statsRoutes);
router.use('/v1/charts', chartsRoutes);
router.use('/v1/market', marketRoutes);

// Mount legacy API routes at root for backward compatibility
router.use('/', apiRoutes);

export default router; 