import React, { useEffect, useState } from 'react';
import { Grid, Paper, Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Button, Select, MenuItem, Divider } from '@mui/material';
import { TrendingUp, Timeline, CheckCircle, EmojiEvents, PieChart, ArrowUpward, ArrowDownward, ShowChart, TrendingDown } from '@mui/icons-material';
import TradeLogTable, { TradeRecord } from './TradeLog';
import CalloutsPanel, { CalloutRecord } from './CalloutsPanel';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart as ReBarChart, Pie, PieChart as RePieChart, Cell, Legend
} from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
import { BarChart as BarChartIcon } from '@mui/icons-material';

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color }) => (
    <Paper sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ color, mr: 1 }}>{icon}</Box>
            <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography variant="h4" sx={{ color }}>{value}</Typography>
    </Paper>
);

interface LeaderboardEntry {
    id: string;
    author: string;
    totalSignals: number;
    successfulSignals: number;
    avgProfitLoss: number;
}

interface AssetStat {
    symbol: string;
    trades: number;
    winRate: number;
    avgReturn: number;
    totalGain: number;
}

interface LiveFeedTrade {
    id: string;
    symbol: string;
    action: string;
    trader: string;
    profitLoss: number;
    time: string;
}

interface DashboardProps {
    metrics: {
        totalTrades: number;
        winRate: number;
        totalGain: number;
        avgReturn: number;
        activeTraders?: number;
        totalVolume?: number;
    };
    leaderboard: LeaderboardEntry[];
    tradeLog: TradeRecord[];
    tradeLogPage: number;
    tradeLogTotalPages: number;
    onTradeLogPageChange: (page: number) => void;
    timeframe: string;
    onTimeframeChange: (tf: string) => void;
    plChartData: { date: string; profit: number }[];
    winRateChartData: { date: string; winRate: number }[];
    volumeChartData: { date: string; trades: number }[];
    assetStats: AssetStat[];
    liveFeed: LiveFeedTrade[];
    traderAssetStats: { [traderId: string]: AssetStat[] };
    callouts: CalloutRecord[];
}

const MiniAssetBarChart: React.FC<{ assetStats: AssetStat[] }> = ({ assetStats }) => (
    <Box sx={{ width: '100%', minWidth: 100, maxWidth: 300 }}>
        <ResponsiveContainer width="100%" height={60}>
            <ReBarChart data={assetStats.slice(0, 5)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="symbol" width={40} hide />
                <Bar dataKey="totalGain" fill="#1976d2" />
                <Tooltip />
            </ReBarChart>
        </ResponsiveContainer>
    </Box>
);

const LeaderboardTable: React.FC<{ leaderboard: LeaderboardEntry[], traderAssetStats: { [traderId: string]: AssetStat[] } }> = ({ leaderboard, traderAssetStats }) => (
    <Paper sx={{ p: 2, overflowX: 'auto' }}>
        <Typography variant="h6" gutterBottom>Leaderboard</Typography>
        <Table size="small" sx={{ minWidth: 650 }}>
            <TableHead>
                <TableRow>
                    <TableCell><EmojiEvents fontSize="small" /></TableCell>
                    <TableCell>Trader</TableCell>
                    <TableCell>Trades</TableCell>
                    <TableCell>Win Rate</TableCell>
                    <TableCell>Total Gain</TableCell>
                    <TableCell>Avg. Return</TableCell>
                    <TableCell sx={{ width: '20vw', minWidth: 100, maxWidth: 300, overflow: 'hidden' }}>Assets</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {leaderboard.map((trader, idx) => (
                    <TableRow key={trader.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                            <Typography component={RouterLink} to={`/trader/${trader.id}`} sx={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                                {trader.author || trader.id}
                            </Typography>
                        </TableCell>
                        <TableCell>{trader.totalSignals}</TableCell>
                        <TableCell>{(trader.successfulSignals / (trader.totalSignals || 1) * 100).toFixed(1)}%</TableCell>
                        <TableCell>${trader.avgProfitLoss ? (trader.avgProfitLoss * trader.totalSignals).toFixed(2) : '0.00'}</TableCell>
                        <TableCell>{trader.avgProfitLoss ? trader.avgProfitLoss.toFixed(2) : '0.00'}%</TableCell>
                        <TableCell sx={{ width: '20vw', minWidth: 100, maxWidth: 300, overflow: 'hidden' }}>
                            {traderAssetStats[trader.id] && traderAssetStats[trader.id].length > 0 ? (
                                <MiniAssetBarChart assetStats={traderAssetStats[trader.id]} />
                            ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>No Data</Typography>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </Paper>
);

const LiveFeed: React.FC<{ feed: LiveFeedTrade[] }> = ({ feed }) => (
    <Paper sx={{ p: 2, mb: 3, background: 'rgba(30,30,30,0.95)' }}>
        <Typography variant="h6" gutterBottom>Live Trade Feed</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', gap: 2, pb: 1 }}>
            {feed.map(trade => {
                const isProfit = trade.profitLoss >= 0;
                return (
                    <Box
                        key={trade.id}
                        sx={{
                            minWidth: 220,
                            maxWidth: 260,
                            p: 2,
                            borderRadius: 2,
                            boxShadow: 3,
                            background: isProfit ? 'rgba(46, 125, 50, 0.15)' : 'rgba(211, 47, 47, 0.15)',
                            border: `1.5px solid ${isProfit ? '#388e3c' : '#d32f2f'}`,
                            color: isProfit ? '#81c784' : '#e57373',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: 0.5
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isProfit ? <ArrowUpward fontSize="small" color="success" /> : <ArrowDownward fontSize="small" color="error" />}
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'inherit' }}>{trade.symbol} {trade.action}</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{trade.trader}</Typography>
                        <Typography variant="body2" sx={{ color: isProfit ? '#81c784' : '#e57373', fontWeight: 700 }}>
                            {isProfit ? '+' : ''}{trade.profitLoss}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            {new Date(trade.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    </Paper>
);

const AssetInsightsTable: React.FC<{ assetStats: AssetStat[] }> = ({ assetStats }) => (
    <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Asset Insights</Typography>
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Trades</TableCell>
                    <TableCell>Win Rate</TableCell>
                    <TableCell>Avg. Return</TableCell>
                    <TableCell>Total Gain</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {assetStats.map((a) => (
                    <TableRow key={a.symbol}>
                        <TableCell>{a.symbol}</TableCell>
                        <TableCell>{a.trades}</TableCell>
                        <TableCell>{(a.winRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{a.avgReturn.toFixed(2)}%</TableCell>
                        <TableCell>${a.totalGain.toFixed(2)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </Paper>
);

const timeframeOptions = [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: 'YTD', value: 'ytd' },
    { label: 'All', value: 'all' },
];

const Dashboard: React.FC<DashboardProps> = ({ metrics, leaderboard, tradeLog, tradeLogPage, tradeLogTotalPages, onTradeLogPageChange, timeframe, onTimeframeChange, plChartData, winRateChartData, volumeChartData, assetStats, liveFeed, traderAssetStats, callouts }) => {
    const [advanced, setAdvanced] = useState<any>(null);
    useEffect(() => {
        fetch(`/api/advanced-metrics?timeframe=${timeframe}`)
            .then(res => res.json())
            .then(setAdvanced)
            .catch(() => setAdvanced(null));
    }, [timeframe]);
    return (
        <Box sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Trading Dashboard</Typography>
                <Select
                    value={timeframe}
                    onChange={e => onTimeframeChange(e.target.value)}
                    size="small"
                    sx={{ minWidth: 100 }}
                >
                    {timeframeOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                </Select>
            </Box>
            <LiveFeed feed={liveFeed} />
            <Grid container spacing={3}>
                <Grid item xs={12} md={12}>
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard title="Total Trades" value={metrics.totalTrades} icon={<Timeline />} color="#1976d2" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard title="Win Rate" value={`${metrics.winRate.toFixed(1)}%`} icon={<CheckCircle />} color="#2e7d32" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard title="Total Gain" value={`$${metrics.totalGain.toLocaleString()}`} icon={<TrendingUp />} color="#2e7d32" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard title="Avg. Return" value={`${metrics.avgReturn.toFixed(2)}%`} icon={<TrendingUp />} color="#1976d2" />
                        </Grid>
                        {metrics.activeTraders !== undefined ? (
                            <Grid item xs={12} sm={6} md={3}>
                                <MetricCard title="Active Traders" value={metrics.activeTraders} icon={<EmojiEvents />} color="#9c27b0" />
                            </Grid>
                        ) : metrics.totalVolume !== undefined ? (
                            <Grid item xs={12} sm={6} md={3}>
                                <MetricCard title="Total Volume" value={`$${metrics.totalVolume.toLocaleString()}`} icon={<BarChartIcon />} color="#f57c00" />
                            </Grid>
                        ) : null}
                    </Grid>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 350 }}>
                        <Typography variant="subtitle1" gutterBottom>P/L Over Time</Typography>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={plChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="profit" stroke="#1976d2" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 350 }}>
                        <Typography variant="subtitle1" gutterBottom>Win Rate Over Time</Typography>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={winRateChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="winRate" stroke="#2e7d32" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 350 }}>
                        <Typography variant="subtitle1" gutterBottom>Trade Volume</Typography>
                        <ResponsiveContainer width="100%" height={250}>
                            <ReBarChart data={volumeChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="trades" fill="#1976d2" />
                            </ReBarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 350 }}>
                        <Typography variant="subtitle1" gutterBottom>Per-Asset Performance</Typography>
                        <ResponsiveContainer width="100%" height={250}>
                            <ReBarChart data={assetStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="symbol" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="totalGain" fill="#2e7d32" />
                            </ReBarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <AssetInsightsTable assetStats={assetStats} />
                </Grid>
                <Grid item xs={12}>
                    <LeaderboardTable leaderboard={leaderboard.slice(0, 5)} traderAssetStats={traderAssetStats} />
                </Grid>
                <Grid item xs={12}>
                    <CalloutsPanel callouts={callouts} />
                </Grid>
                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <TradeLogTable
                            trades={tradeLog}
                            currentPage={tradeLogPage}
                            totalPages={tradeLogTotalPages}
                            onPageChange={onTradeLogPageChange}
                        />
                    </Paper>
                </Grid>
            </Grid>
            {/* Advanced Analytics Section */}
            <Box sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Advanced Analytics</Typography>
                {advanced ? (
                    <>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Sharpe Ratio" value={advanced.sharpeRatio?.toFixed(2)} icon={<ShowChart />} color="#90caf9" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Max Drawdown" value={`$${advanced.maxDrawdown?.toFixed(2)}`} icon={<TrendingDown />} color="#e57373" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Profit Factor" value={advanced.profitFactor?.toFixed(2)} icon={<PieChart />} color="#fbc02d" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Expectancy" value={`$${advanced.expectancy?.toFixed(2)}`} icon={<TrendingUp />} color="#81c784" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Avg. Hold (s)" value={advanced.avgHoldingTime?.toFixed(0)} icon={<Timeline />} color="#ba68c8" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Win Streak" value={advanced.winStreak} icon={<EmojiEvents />} color="#4caf50" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Loss Streak" value={advanced.lossStreak} icon={<EmojiEvents />} color="#f44336" /></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><MetricCard title="Volatility" value={advanced.volatility?.toFixed(2)} icon={<ReBarChart />} color="#00bcd4" /></Grid>
                        </Grid>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, height: 350 }}>
                                    <Typography variant="subtitle1" gutterBottom>Monthly Performance</Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={Object.entries(advanced.monthlyPerformance || {}).map(([date, value]) => ({ date, value }))}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, height: 350 }}>
                                    <Typography variant="subtitle1" gutterBottom>Return Distribution</Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <ReBarChart data={(advanced.returnDistribution || []).map((v: number, i: number) => ({ bin: i, count: v }))}>
                                            <XAxis dataKey="bin" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#1976d2" />
                                        </ReBarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, height: 350 }}>
                                    <Typography variant="subtitle1" gutterBottom>Trade Type Breakdown</Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <RePieChart>
                                            <Pie data={Object.entries(advanced.tradeTypeBreakdown || {}).map(([type, value]) => ({ name: type, value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label />
                                            <Tooltip />
                                            <Legend />
                                        </RePieChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                        </Grid>
                    </>
                ) : (
                    <Typography color="text.secondary">No advanced analytics available.</Typography>
                )}
            </Box>
        </Box>
    );
};

export default Dashboard; 
