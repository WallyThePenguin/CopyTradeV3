/**
 * Calculate performance metrics from trades
 * @param {Array} trades - Array of trade objects
 * @returns {Object} - Performance metrics
 */
export function calculatePerformance(trades) {
    const totalTrades = trades.length;
    const successfulTrades = trades.filter(t => t.profitLoss > 0).length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const avgReturn = totalTrades > 0 ? totalProfit / totalTrades : 0;

    return {
        trades: totalTrades,
        successfulTrades,
        totalProfit,
        successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
        avgReturn,
        timestamp: new Date().toISOString()
    };
}

/**
 * Compute advanced metrics from trades
 * @param {Array} trades - Array of trade objects
 * @returns {Object} - Advanced metrics
 */
export function computeAdvancedMetrics(trades) {
    if (!trades || trades.length === 0) return {};
    
    const returns = trades.map(t => t.profitLoss || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev ? avgReturn / stdDev : 0;
    
    // Max Drawdown
    let maxDrawdown = 0, peak = 0, trough = 0, runningMax = 0;
    let equity = 0;
    for (const r of returns) {
        equity += r;
        if (equity > runningMax) runningMax = equity;
        const drawdown = runningMax - equity;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            peak = runningMax;
            trough = equity;
        }
    }
    
    // Profit Factor
    const grossProfit = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss ? grossProfit / grossLoss : 0;
    
    // Expectancy
    const winCount = returns.filter(r => r > 0).length;
    const lossCount = returns.filter(r => r < 0).length;
    const expectancy = returns.length > 0 ? (grossProfit - grossLoss) / returns.length : 0;
    
    // Avg Holding Time
    const holdingTimes = trades.map(t => t.exitTime && t.entryTime ? (new Date(t.exitTime) - new Date(t.entryTime)) / 1000 : 0).filter(x => x > 0);
    const avgHoldingTime = holdingTimes.length > 0 ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0;
    
    // Win/Loss Streaks
    let winStreak = 0, maxWinStreak = 0, lossStreak = 0, maxLossStreak = 0;
    for (const r of returns) {
        if (r > 0) {
            winStreak++;
            maxWinStreak = Math.max(maxWinStreak, winStreak);
            lossStreak = 0;
        } else if (r < 0) {
            lossStreak++;
            maxLossStreak = Math.max(maxLossStreak, lossStreak);
            winStreak = 0;
        } else {
            winStreak = 0;
            lossStreak = 0;
        }
    }
    
    // Monthly/Weekly Performance
    const monthly = {};
    const weekly = {};
    trades.forEach(t => {
        const d = new Date(t.exitTime || t.createdAt);
        const month = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const week = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 6 - d.getDay()) / 7)}`;
        monthly[month] = (monthly[month] || 0) + (t.profitLoss || 0);
        weekly[week] = (weekly[week] || 0) + (t.profitLoss || 0);
    });
    
    // Volatility
    const volatility = stdDev;
    
    // Return Distribution (histogram)
    const bins = Array(11).fill(0);
    returns.forEach(r => {
        const idx = Math.max(0, Math.min(10, Math.floor((r + 1) * 5)));
        bins[idx]++;
    });
    
    // Trade Type Breakdown (buy/sell)
    const tradeTypeBreakdown = trades.reduce((acc, t) => {
        const type = t.action || 'UNKNOWN';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    
    return {
        sharpeRatio,
        maxDrawdown,
        profitFactor,
        expectancy,
        avgHoldingTime,
        winStreak: maxWinStreak,
        lossStreak: maxLossStreak,
        monthlyPerformance: monthly,
        weeklyPerformance: weekly,
        volatility,
        returnDistribution: bins,
        tradeTypeBreakdown
    };
}