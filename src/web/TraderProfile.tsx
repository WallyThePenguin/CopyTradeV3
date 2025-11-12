import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Button, Grid, Avatar, Card, CardContent } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, EmojiEvents, ShowChart } from '@mui/icons-material';

interface AssetStat {
    symbol: string;
    trades: number;
    winRate: number;
    avgReturn: number;
    totalGain: number;
}

interface TradeRecord {
    tradeId: string;
    symbol: string;
    entryTime: string;
    exitTime: string;
    entryPrice: number;
    exitPrice: number;
    returnPct: number;
}

const TraderProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [trader, setTrader] = useState<any>(null);
    const [assetStats, setAssetStats] = useState<AssetStat[]>([]);
    const [trades, setTrades] = useState<TradeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [advanced, setAdvanced] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [traderRes, assetRes, tradesRes] = await Promise.all([
                    fetch(`/api/trader-stats?traderId=${id}`),
                    fetch(`/api/trader-assets/${id}`),
                    fetch(`/api/trades?traderId=${id}&limit=20`)
                ]);
                const traderData = await traderRes.json();
                setTrader(Array.isArray(traderData) ? traderData[0] : traderData);
                setAssetStats(await assetRes.json());
                const tradesData = await tradesRes.json();
                setTrades(Array.isArray(tradesData.trades) ? tradesData.trades : []);
            } catch {
                setTrader(null);
                setAssetStats([]);
                setTrades([]);
            }
            setLoading(false);
        };
        fetchData();
    }, [id]);

    useEffect(() => {
        fetch(`/api/trader-advanced-metrics/${id}`)
            .then(res => res.json())
            .then(setAdvanced)
            .catch(() => setAdvanced(null));
    }, [id]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
    if (!trader) return <Typography variant="h6" sx={{ mt: 4 }}>Trader not found.</Typography>;

    // Metrics
    const totalTrades = trader.totalSignals || 0;
    const winRate = totalTrades > 0 ? (trader.successfulSignals / totalTrades) * 100 : 0;
    const totalGain = assetStats.reduce((sum, a) => sum + (a.totalGain || 0), 0);
    const avgReturn = totalTrades > 0 ? totalGain / totalTrades : 0;
    const bestAsset = assetStats.reduce((best, a) => (a.totalGain > (best?.totalGain || -Infinity) ? a : best), null as AssetStat | null);
    const worstAsset = assetStats.reduce((worst, a) => (a.totalGain < (worst?.totalGain || Infinity) ? a : worst), null as AssetStat | null);
    const mostTradedAsset = assetStats.reduce((most, a) => (a.trades > (most?.trades || -Infinity) ? a : most), null as AssetStat | null);

    return (
        <Box sx={{ py: 4 }}>
            <Button component={RouterLink} to="/" variant="outlined" sx={{ mb: 2 }}>Back to Dashboard</Button>
            {/* Header Section */}
            <Paper sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 3, background: 'linear-gradient(90deg, #232526 0%, #414345 100%)' }}>
                <Avatar sx={{ width: 72, height: 72, fontSize: 36, bgcolor: '#1976d2' }}>{(trader.author || trader.id || '?')[0]}</Avatar>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#fff' }}>Trader Profile</Typography>
                    <Typography variant="h6" sx={{ color: '#90caf9' }}>{trader.author || trader.id}</Typography>
                    <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Channel: {trader.channelId}</Typography>
                </Box>
            </Paper>
            {/* Metrics Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Total Trades</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalTrades}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Win Rate</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmojiEvents fontSize="small" color="success" />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{winRate.toFixed(1)}%</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Total Gain</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUp fontSize="small" color="success" />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>${totalGain.toFixed(2)}</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Avg. Return</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ShowChart fontSize="small" color="primary" />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{avgReturn.toFixed(2)}%</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Most Traded Asset</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{mostTradedAsset?.symbol || '-'}</Typography>
                            <Typography variant="body2" color="text.secondary">{mostTradedAsset?.trades || 0} trades</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Best Asset</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#81c784' }}>{bestAsset?.symbol || '-'}</Typography>
                            <Typography variant="body2" color="text.secondary">${bestAsset?.totalGain?.toFixed(2) || '0.00'}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#263238', color: '#fff' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Worst Asset</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e57373' }}>{worstAsset?.symbol || '-'}</Typography>
                            <Typography variant="body2" color="text.secondary">${worstAsset?.totalGain?.toFixed(2) || '0.00'}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            {/* Advanced Analytics Section */}
            <Box sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Advanced Analytics</Typography>
                {advanced ? (
                    <>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Sharpe Ratio</Typography><Typography variant="h5">{advanced.sharpeRatio?.toFixed(2)}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Max Drawdown</Typography><Typography variant="h5">${advanced.maxDrawdown?.toFixed(2)}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Profit Factor</Typography><Typography variant="h5">{advanced.profitFactor?.toFixed(2)}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Expectancy</Typography><Typography variant="h5">${advanced.expectancy?.toFixed(2)}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Avg. Hold (s)</Typography><Typography variant="h5">{advanced.avgHoldingTime?.toFixed(0)}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Win Streak</Typography><Typography variant="h5">{advanced.winStreak}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Loss Streak</Typography><Typography variant="h5">{advanced.lossStreak}</Typography></CardContent></Card></Grid>
                            <Grid item xs={12} sm={6} md={2.4}><Card sx={{ bgcolor: '#263238', color: '#fff' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Volatility</Typography><Typography variant="h5">{advanced.volatility?.toFixed(2)}</Typography></CardContent></Card></Grid>
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
                                        <BarChart data={(advanced.returnDistribution || []).map((v: number, i: number) => ({ bin: i, count: v }))}>
                                            <XAxis dataKey="bin" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#1976d2" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, height: 350 }}>
                                    <Typography variant="subtitle1" gutterBottom>Trade Type Breakdown</Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={Object.entries(advanced.tradeTypeBreakdown || {}).map(([type, value]) => ({ name: type, value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label />
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                        </Grid>
                    </>
                ) : (
                    <Typography color="text.secondary">No advanced analytics available.</Typography>
                )}
            </Box>
            {/* Per-Asset Performance Chart */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Per-Asset Performance</Typography>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={assetStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="symbol" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalGain" fill="#1976d2" />
                    </BarChart>
                </ResponsiveContainer>
                {/* Asset Metrics Table */}
                <Table size="small" sx={{ mt: 2 }}>
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
            {/* Recent Trades */}
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Recent Trades</Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Symbol</TableCell>
                            <TableCell>Entry Time</TableCell>
                            <TableCell>Exit Time</TableCell>
                            <TableCell>Entry Price</TableCell>
                            <TableCell>Exit Price</TableCell>
                            <TableCell>Return %</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {trades.map(tr => (
                            <TableRow key={tr.tradeId}>
                                <TableCell>{tr.symbol}</TableCell>
                                <TableCell>{tr.entryTime}</TableCell>
                                <TableCell>{tr.exitTime}</TableCell>
                                <TableCell>${typeof tr.entryPrice === 'number' && !isNaN(tr.entryPrice) ? tr.entryPrice.toFixed(2) : '0.00'}</TableCell>
                                <TableCell>${typeof tr.exitPrice === 'number' && !isNaN(tr.exitPrice) ? tr.exitPrice.toFixed(2) : '0.00'}</TableCell>
                                <TableCell>{typeof tr.returnPct === 'number' && !isNaN(tr.returnPct) ? (tr.returnPct * 100).toFixed(2) : '0.00'}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default TraderProfile; 