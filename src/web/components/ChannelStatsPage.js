import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PerformanceGraph from './PerformanceGraph';
import ChannelStats from './ChannelStats';

const ChannelStatsPage = () => {
    const { channelId } = useParams();
    const [channelData, setChannelData] = useState(null);
    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (channelId) {
            fetchChannelData(channelId);
        }
    }, [channelId]);

    const fetchChannelData = async (id) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/channels/${id}/stats`);
            if (!response.ok) throw new Error('Failed to fetch channel stats');
            const data = await response.json();
            setChannelData(data.channel);
            setPerformanceData(data.performanceHistory || []);
        } catch (err) {
            setError('Unable to load channel data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center mt-10 text-xl">Loading...</div>;
    }

    if (error) {
        return <div className="text-center mt-10 text-red-500">{error}</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-3xl font-bold mb-4">{channelData?.name} - Statistics</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Performance</h2>
                        <div className="h-[300px]">
                            <PerformanceGraph data={performanceData} />
                        </div>
                    </div>
                </div>
                <div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <ChannelStats channel={channelData} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChannelStatsPage;