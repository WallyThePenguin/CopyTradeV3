import React, { useState, useEffect } from 'react';
import PerformanceGraph from './PerformanceGraph';
import ChannelStats from './ChannelStats';

const Dashboard = () => {
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [performanceData, setPerformanceData] = useState([]);
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchChannels();
    }, []);

    useEffect(() => {
        if (selectedChannel) {
            fetchChannelStats(selectedChannel);
            fetchTrades(selectedChannel);
        }
    }, [selectedChannel]);

    const fetchChannels = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/channels');
            if (!response.ok) throw new Error('Failed to fetch channels');
            const data = await response.json();
            setChannels(data);
            if (data.length > 0) {
                setSelectedChannel(data[0].id);
            }
        } catch (error) {
            setError('Failed to load channels');
            console.error('Error fetching channels:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchChannelStats = async (channelId) => {
        try {
            const response = await fetch(`/api/channels/${channelId}/stats`);
            if (!response.ok) throw new Error('Failed to fetch channel stats');
            const data = await response.json();
            setPerformanceData(data.performanceHistory || []);
        } catch (error) {
            setError('Failed to load channel statistics');
            console.error('Error fetching channel stats:', error);
        }
    };

    const fetchTrades = async (channelId) => {
        try {
            const response = await fetch(`/api/channels/${channelId}/trades`);
            if (!response.ok) throw new Error('Failed to fetch trades');
            const data = await response.json();
            setTrades(data);
        } catch (error) {
            setError('Failed to load trades');
            console.error('Error fetching trades:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl text-red-600">{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-4">Trading Dashboard</h1>
                    <select
                        className="w-full md:w-64 p-2 border rounded bg-white"
                        value={selectedChannel || ''}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                    >
                        <option value="">Select Channel</option>
                        {channels.map(channel => (
                            <option key={channel.id} value={channel.id}>
                                {channel.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Channel Performance</h2>
                            <div className="h-[300px]">
                                <PerformanceGraph data={performanceData} />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Recent Trades</h2>
                            <table className="w-full text-left">
                                <thead>
                                    <tr>
                                        <th className="py-2">Symbol</th>
                                        <th className="py-2">Channel</th>
                                        <th className="py-2">P/L</th>
                                        <th className="py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map(trade => (
                                        <tr key={trade.id} className="border-t">
                                            <td className="py-2">{trade.symbol}</td>
                                            <td className="py-2">{trade.channel?.name || 'Unknown'}</td>
                                            <td className={`py-2 ${trade.profitLoss > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                ${trade.profitLoss?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="py-2">{trade.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <ChannelStats channel={channels.find(c => c.id === selectedChannel)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
