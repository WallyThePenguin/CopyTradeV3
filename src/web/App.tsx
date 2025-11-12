import React, { useEffect, useState, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Container, Grid, Snackbar, Paper, Box, Table, TableHead, TableRow, TableCell, TableBody, Tabs, Tab } from '@mui/material';
import TradersTable, { TraderInfo } from './TradersTable';
import TradeLogTable, { TradeRecord } from './TradeLog';
import ApproveTradeModal, { TradeSignal } from './ApproveTradeModal';
import { TrendingUp, TrendingDown, Timeline, CheckCircle, EmojiEvents } from '@mui/icons-material';
import Dashboard from './Dashboard';
import { CalloutRecord } from './CalloutsPanel';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TraderProfile from './TraderProfile';
import ChannelsPage from './ChannelsPage';
import UsersPage from './UsersPage';

const WS_URL = (() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/signals`;
})();

interface PerformanceData {
  trades: number;
  successfulTrades: number;
  totalProfit: number;
  successRate: number;
  timestamp: string;
}

interface MarketUpdate {
  id: string;
  summary: string;
  sentiment: string;
  symbol?: string;
  createdAt: string;
}

interface TraderStats {
  id: string;
  author: string;
  channelId: string;
  totalSignals: number;
  successfulSignals: number;
  avgConfidence: number;
  avgProfitLoss: number;
  bestSymbols: any[];
  tradingHours: any[];
  lastActive: string;
}

interface BotStats {
  totalTrades: number;
  successfulTrades: number;
  totalProfitLoss: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface LeaderboardEntry {
  id: string;
  author: string;
  totalSignals: number;
  successfulSignals: number;
  avgProfitLoss: number;
}

interface ChartPoint {
  date: string;
  profit?: number;
  winRate?: number;
  trades?: number;
}

interface AssetStat {
  symbol: string;
  trades: number;
  winRate: number;
  avgReturn: number;
  totalGain: number;
}

interface PlChartPoint { date: string; profit: number; }
interface WinRateChartPoint { date: string; winRate: number; }
interface VolumeChartPoint { date: string; trades: number; }

interface LiveFeedTrade {
  id: string;
  symbol: string;
  action: string;
  trader: string;
  profitLoss: number;
  time: string;
}

const MetricCard = ({ title, value, icon, color }) => (
  <Paper sx={{ p: 2, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <Box sx={{ color, mr: 1 }}>{icon}</Box>
      <Typography variant="h6">{title}</Typography>
    </Box>
    <Typography variant="h4" sx={{ color }}>{value}</Typography>
  </Paper>
);

const LeaderboardTable = ({ leaderboard }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>Leaderboard</Typography>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell><EmojiEvents fontSize="small" /></TableCell>
          <TableCell>Trader</TableCell>
          <TableCell>Trades</TableCell>
          <TableCell>Win Rate</TableCell>
          <TableCell>Total Gain</TableCell>
          <TableCell>Avg. Return</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {leaderboard.map((trader, idx) => (
          <TableRow key={trader.id}>
            <TableCell>{idx + 1}</TableCell>
            <TableCell>{trader.author || trader.id}</TableCell>
            <TableCell>{trader.totalSignals}</TableCell>
            <TableCell>{(trader.successfulSignals / (trader.totalSignals || 1) * 100).toFixed(1)}%</TableCell>
            <TableCell>${trader.avgProfitLoss ? (trader.avgProfitLoss * trader.totalSignals).toFixed(2) : '0.00'}</TableCell>
            <TableCell>{trader.avgProfitLoss ? trader.avgProfitLoss.toFixed(2) : '0.00'}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Paper>
);

const App: React.FC = () => {
  const [traders, setTraders] = useState<TraderInfo[]>([]);
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>([]);
  const [tradeLogPage, setTradeLogPage] = useState(1);
  const [tradeLogTotalPages, setTradeLogTotalPages] = useState(1);
  const [tradeLogLoading, setTradeLogLoading] = useState(false);
  const [activeTrades, setActiveTrades] = useState<TradeRecord[]>([]);
  const [pending, setPending] = useState<TradeSignal[]>([]);
  const [modal, setModal] = useState<TradeSignal | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [marketUpdates, setMarketUpdates] = useState<MarketUpdate[]>([]);
  const [traderStats, setTraderStats] = useState<TraderStats[]>([]);
  const [botStats, setBotStats] = useState<BotStats | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [metrics, setMetrics] = useState({ totalTrades: 0, winRate: 0, totalGain: 0, avgReturn: 0 });
  const [plChartData, setPlChartData] = useState<PlChartPoint[]>([]);
  const [winRateChartData, setWinRateChartData] = useState<WinRateChartPoint[]>([]);
  const [volumeChartData, setVolumeChartData] = useState<VolumeChartPoint[]>([]);
  const [assetStats, setAssetStats] = useState<AssetStat[]>([]);
  const [timeframe, setTimeframe] = useState('30d');
  const [liveFeed, setLiveFeed] = useState<LiveFeedTrade[]>([]);
  const [callouts, setCallouts] = useState<CalloutRecord[]>([]);
  const [traderAssetStats, setTraderAssetStats] = useState<{ [traderId: string]: AssetStat[] }>({});
  const navigate = useNavigate();
  const location = useLocation();

  const currentView = location.pathname.startsWith('/channels')
    ? 'channels'
    : location.pathname.startsWith('/users')
      ? 'users'
      : 'dashboard';

  const handleNavChange = (_: React.SyntheticEvent, value: string) => {
    if (value === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${value}`);
    }
  };

  const handleWebSocketMessage = useCallback((msg: any) => {
    try {
      switch (msg.type) {
        case 'trade_opened':
          setActiveTrades((p) => [...p, msg.data]);
          setTraders((p) =>
            p.map((t) => (t.channelId === msg.data.channelId ? { ...t, active: true } : t))
          );
          break;
        case 'trade_closed':
          setActiveTrades((p) => p.filter((t) => t.tradeId !== msg.data.tradeId));
          setTradeLog((p) => [msg.data, ...p]);
          setTraders((p) =>
            p.map((t) => (t.channelId === msg.data.channelId ? { ...t, active: false } : t))
          );
          break;
        case 'trade_signal':
          setPending((p) => [...p, msg.data]);
          if (!modal) {
            setModal(msg.data);
            setPending((p) => p.slice(1));
          }
          break;
        case 'metrics_update':
          setTraders((p) => p.map((t) => (t.channelId === msg.data.channelId ? { ...t, ...msg.data } : t)));
          break;
        case 'performance_update':
          setPerformance(msg.data);
          break;
        case 'market_update':
          setMarketUpdates((p) => [msg.data, ...p].slice(0, 50));
          break;
        case 'trader_stats_update':
          setTraderStats((p) => p.map((t) => (t.id === msg.data.id ? { ...t, ...msg.data } : t)));
          break;
        case 'bot_stats_update':
          setBotStats(msg.data);
          break;
        default:
          console.warn('Unknown message type:', msg.type);
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
      setErrorMsg('Error processing update');
    }
  }, [modal]);

  // Fetch paginated trades
  const fetchTradeLog = async (page = 1) => {
    setTradeLogLoading(true);
    try {
      const res = await fetch(`/api/trades?page=${page}`);
      if (!res.ok) throw new Error('Failed to fetch trades');
      const data = await res.json();
      setTradeLog(Array.isArray(data.trades) ? data.trades : []);
      setTradeLogPage(data.currentPage || 1);
      setTradeLogTotalPages(data.pages || 1);
    } catch (err) {
      setErrorMsg('Failed to load trade log');
    } finally {
      setTradeLogLoading(false);
    }
  };

  // Fetch all dashboard data for the selected timeframe
  const fetchDashboardData = useCallback(async (page = 1, tf = timeframe) => {
    try {
      const [metricsRes, leaderboardRes, tradesRes, plRes, winRes, volRes, assetRes, calloutsRes] = await Promise.all([
        fetch(`/api/performance?timeframe=${tf}`),
        fetch(`/api/trader-stats?timeframe=${tf}`),
        fetch(`/api/trades?timeframe=${tf}&page=${page}`),
        fetch(`/api/charts/pl?timeframe=${tf}`),
        fetch(`/api/charts/winrate?timeframe=${tf}`),
        fetch(`/api/charts/volume?timeframe=${tf}`),
        fetch(`/api/charts/assets?timeframe=${tf}`),
        fetch(`/api/callouts?limit=50`)
      ]);
      const [metricsData, leaderboardData, tradesData, plData, winData, volData, assetData, calloutsData] = await Promise.all([
        metricsRes.json(),
        leaderboardRes.json(),
        tradesRes.json(),
        plRes.json(),
        winRes.json(),
        volRes.json(),
        assetRes.json(),
        calloutsRes.json()
      ]);
      setMetrics({
        totalTrades: metricsData.trades || 0,
        winRate: metricsData.successRate || 0,
        totalGain: metricsData.totalProfit || 0,
        avgReturn: metricsData.trades > 0 ? (metricsData.totalProfit / metricsData.trades) : 0
      });
      setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData as LeaderboardEntry[] : []);
      setTradeLog(Array.isArray(tradesData.trades) ? tradesData.trades : []);
      setTradeLogPage(tradesData.currentPage || 1);
      setTradeLogTotalPages(tradesData.pages || 1);
      setPlChartData(Array.isArray(plData) ? plData as PlChartPoint[] : []);
      setWinRateChartData(Array.isArray(winData) ? winData as WinRateChartPoint[] : []);
      setVolumeChartData(Array.isArray(volData) ? volData as VolumeChartPoint[] : []);
      setAssetStats(Array.isArray(assetData) ? assetData as AssetStat[] : []);
      setCallouts(Array.isArray(calloutsData) ? calloutsData as CalloutRecord[] : []);
    } catch (err) {
      setErrorMsg('Failed to load dashboard data');
    }
  }, [timeframe]);

  // Initial and timeframe change fetch
  useEffect(() => {
    fetchDashboardData(1, timeframe);
  }, [fetchDashboardData, timeframe]);

  // Paginate trade log
  const handleTradeLogPageChange = (page: number) => {
    if (page < 1 || page > tradeLogTotalPages) return;
    fetchDashboardData(page, timeframe);
  };

  // Timeframe change
  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    fetchDashboardData(1, tf);
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        setErrorMsg(null);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          handleWebSocketMessage(msg);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setErrorMsg('Connection error');
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [handleWebSocketMessage]);

  const handleToggleAutoCopy = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/channels/${id}/auto-copy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error('Failed to update auto-copy');
      }

      setTraders((p) => p.map((t) => (t.channelId === id ? { ...t, autoCopy: enabled } : t)));
    } catch (err) {
      console.error('Error updating auto-copy:', err);
      setErrorMsg('Failed to update auto-copy');
    }
  };

  const handleChangeMode = async (id: string, mode: 'manual' | 'score') => {
    try {
      const response = await fetch(`/api/channels/${id}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      if (!response.ok) {
        throw new Error('Failed to update mode');
      }

      setTraders((p) => p.map((t) => (t.channelId === id ? { ...t, mode } : t)));
    } catch (err) {
      console.error('Error updating mode:', err);
      setErrorMsg('Failed to update mode');
    }
  };

  const closeModal = () =>
    setPending((prev) => {
      const [next, ...rest] = prev;
      if (next) {
        setModal(next);
      } else {
        setModal(null);
      }
      return rest;
    });

  const handleApprove = async (trade: TradeSignal) => {
    try {
      const response = await fetch(`/api/trades/${trade.tradeId}/approve`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to approve trade');
      }
    } catch (err) {
      console.error('Error approving trade:', err);
      setErrorMsg('Failed to approve trade');
    }
    closeModal();
  };

  const handleReject = async (trade: TradeSignal) => {
    try {
      const response = await fetch(`/api/trades/${trade.tradeId}/reject`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to reject trade');
      }
    } catch (err) {
      console.error('Error rejecting trade:', err);
      setErrorMsg('Failed to reject trade');
    }
    closeModal();
  };

  // Fetch per-trader asset stats when leaderboard changes
  useEffect(() => {
    const fetchTraderAssets = async () => {
      const stats: { [traderId: string]: AssetStat[] } = {};
      await Promise.all(
        leaderboard.slice(0, 5).map(async (trader) => {
          try {
            const res = await fetch(`/api/trader-assets/${trader.id}?timeframe=${timeframe}`);
            const data = await res.json();
            stats[trader.id] = Array.isArray(data) ? data : [];
          } catch {
            stats[trader.id] = [];
          }
        })
      );
      setTraderAssetStats(stats);
    };
    if (leaderboard.length > 0) fetchTraderAssets();
  }, [leaderboard, timeframe]);

  // Live feed: WebSocket for real-time, fallback to polling
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    const connectWebSocket = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        setWsConnected(true);
        setErrorMsg(null);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'trade_feed') {
            setLiveFeed(Array.isArray(msg.data) ? msg.data : []);
          }
        } catch { }
      };
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      };
      ws.onerror = () => {
        setErrorMsg('Connection error');
      };
    };
    connectWebSocket();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Add logging before render
  console.log('TradeLogTable trades:', tradeLog);
  console.log('TradersTable traders:', traders);

  return (
    <>
      <AppBar position="static">
        <Toolbar sx={{ gap: 3 }}>
          <Typography variant="h6" component="div">
            CopyTrade Dashboard
          </Typography>
          <Tabs value={currentView} onChange={handleNavChange} textColor="inherit" indicatorColor="secondary" sx={{ flexGrow: 1 }}>
            <Tab value="dashboard" label="Dashboard" />
            <Tab value="channels" label="Channels" />
            <Tab value="users" label="Users" />
          </Tabs>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color={wsConnected ? 'success.main' : 'error.main'}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4 }} maxWidth="xl">
        <Routes>
          <Route path="/" element={
            <Dashboard
              metrics={metrics}
              leaderboard={leaderboard.slice(0, 5)}
              tradeLog={tradeLog}
              tradeLogPage={tradeLogPage}
              tradeLogTotalPages={tradeLogTotalPages}
              onTradeLogPageChange={handleTradeLogPageChange}
              timeframe={timeframe}
              onTimeframeChange={handleTimeframeChange}
              plChartData={plChartData}
              winRateChartData={winRateChartData}
              volumeChartData={volumeChartData}
              assetStats={assetStats}
              liveFeed={liveFeed}
              traderAssetStats={traderAssetStats}
              callouts={callouts}
            />
          } />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/trader/:id" element={<TraderProfile />} />
        </Routes>
        {modal && (
          <ApproveTradeModal trade={modal} onApprove={handleApprove} onReject={handleReject} onClose={closeModal} />
        )}
        <Snackbar
          open={!!errorMsg}
          message={errorMsg}
          autoHideDuration={6000}
          onClose={() => setErrorMsg(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Container>
    </>
  );
};

export default App;
