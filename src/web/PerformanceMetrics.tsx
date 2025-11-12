import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { TrendingUp, TrendingDown, Timeline, CheckCircle } from '@mui/icons-material';

interface PerformanceData {
    trades: number;
    successfulTrades: number;
    totalProfit: number;
    successRate: number;
    timestamp: string;
}

interface Props {
    data: PerformanceData | null;
}

const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({
    title,
    value,
    icon,
    color
}) => (
    <Paper sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ color, mr: 1 }}>{icon}</Box>
            <Typography variant="h6" component="div">
                {title}
            </Typography>
        </Box>
        <Typography variant="h4" component="div" sx={{ color }}>
            {value}
        </Typography>
    </Paper>
);

const PerformanceMetrics: React.FC<Props> = ({ data }) => {
    if (!data) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" color="text.secondary">
                    Loading performance metrics...
                </Typography>
            </Box>
        );
    }

    const formatProfit = (profit: number | undefined) => {
        if (typeof profit !== 'number' || isNaN(profit)) return '+$0.00';
        const sign = profit >= 0 ? '+' : '';
        return `${sign}$${profit.toFixed(2)}`;
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Performance Metrics
            </Typography>
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Total Trades"
                        value={data.trades}
                        icon={<Timeline />}
                        color="#1976d2"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Success Rate"
                        value={typeof data.successRate === 'number' && !isNaN(data.successRate) ? `${data.successRate.toFixed(1)}%` : '0.0%'}
                        icon={<CheckCircle />}
                        color="#2e7d32"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Total P&L"
                        value={formatProfit(data.totalProfit)}
                        icon={data.totalProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
                        color={data.totalProfit >= 0 ? '#2e7d32' : '#d32f2f'}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Successful Trades"
                        value={data.successfulTrades}
                        icon={<CheckCircle />}
                        color="#2e7d32"
                    />
                </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Last updated: {new Date(data.timestamp).toLocaleString()}
            </Typography>
        </Box>
    );
};

export default PerformanceMetrics; 