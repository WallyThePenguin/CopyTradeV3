/**
 * Get start date based on timeframe
 * @param {string} timeframe - Timeframe string ('7d', '30d', 'ytd', 'all')
 * @returns {Date} - Start date for the timeframe
 */
export function getStartDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
        case '7d':
            return new Date(now.setDate(now.getDate() - 7));
        case '30d':
            return new Date(now.setDate(now.getDate() - 30));
        case 'ytd':
            return new Date(now.getFullYear(), 0, 1);
        case 'all':
            return new Date(0);
        default:
            return new Date(now.setDate(now.getDate() - 30));
    }
}