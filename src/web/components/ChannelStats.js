import React, { useEffect, useState } from 'react';

const ChannelStats = ({ channelId }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!channelId) return;

        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/channels/${channelId}/stats`);
                if (!response.ok) throw new Error('Failed to fetch channel stats');
                const data = await response.json();
                setStats(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [channelId]);

    if (loading) return <div>Loading channel stats...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;
    if (!stats) return <div>No stats available</div>;

    return (
        <div className="space-y-2">
            <h2 className="text-xl font-semibold">Channel Stats</h2>
            <div><strong>Name:</strong> {stats.name}</div>
            <div><strong>Type:</strong> {stats.type}</div>
            <div><strong>Total Trades:</strong> {stats.totalTrades}</div>
            <div><strong>Win Rate:</strong> {(stats.winRate * 100).toFixed(1)}%</div>
            <div><strong>Average P&L:</strong> ${stats.avgProfit.toFixed(2)}</div>
            <div><strong>Performance Score:</strong> {stats.performance.toFixed(2)}</div>
        </div>
    );
};

export default ChannelStats;
