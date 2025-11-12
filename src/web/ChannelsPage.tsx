import React, { useEffect, useState, useMemo } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Tooltip
} from '@mui/material';

interface ChannelSummary {
  id: string;
  name: string;
  type: string;
  mode: string;
  enabled: boolean;
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  lastTradeAt?: string | null;
}

interface ChannelDetail {
  channel: ChannelSummary;
  stats: {
    totalTrades: number;
    totalProfit: number;
    avgProfit: number;
    winRate: number;
    lossRate: number;
    lastTradeAt?: string | null;
    bestTrade?: TradeInfo | null;
    worstTrade?: TradeInfo | null;
  };
  recentTrades: TradeInfo[];
  leaderBoard: LeaderInfo[];
}

interface TradeInfo {
  id: string;
  symbol: string;
  action: string;
  profitLoss: number | null;
  createdAt: string;
}

interface LeaderInfo {
  id: string;
  author: string;
  channelId: string;
  channelName: string;
  totalSignals: number;
  winRate: number;
  avgProfitLoss: number;
}

const pageSize = 10;

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const ChannelsPage: React.FC = () => {
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelDetail | null>(null);

  const fetchChannels = async (nextPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels?page=${nextPage}&limit=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch channels');
      const data = await res.json();
      setChannels(Array.isArray(data.channels) ? data.channels : []);
      setTotalPages(data.pages || 1);
      setPage(data.currentPage || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load channels');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannelDetail = async (channelId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch channel stats');
      const data = await res.json();
      setSelectedChannel(data);
      setDetailOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load channel stats');
      setSelectedChannel(null);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels(1);
  }, []);

  const handleChangePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    fetchChannels(nextPage);
  };

  const handleView = (channelId: string) => {
    fetchChannelDetail(channelId);
  };

  const summaryStats = useMemo(() => {
    if (!channels.length) return null;
    const totalTrades = channels.reduce((sum, c) => sum + c.totalTrades, 0);
    const totalProfit = channels.reduce((sum, c) => sum + c.totalProfit, 0);
    return { totalTrades, totalProfit };
  }, [channels]);

  return (
    <Box sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Channels</Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of monitored channels and their recent performance.
          </Typography>
        </Box>
        {summaryStats && (
          <Box>
            <Typography variant="body2" color="text.secondary">Aggregate Trades</Typography>
            <Typography variant="h6">{summaryStats.totalTrades.toLocaleString()}</Typography>
          </Box>
        )}
      </Box>

      <Paper sx={{ mb: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Channel</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell align="right">Trades</TableCell>
                <TableCell align="right">Win Rate</TableCell>
                <TableCell align="right">Total P/L</TableCell>
                <TableCell>Last Trade</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{channel.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{channel.type}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={channel.mode || 'manual'}
                      color={channel.enabled ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">{channel.totalTrades.toLocaleString()}</TableCell>
                  <TableCell align="right">{formatPercent(channel.winRate)}</TableCell>
                  <TableCell align="right">
                    <Typography color={channel.totalProfit >= 0 ? 'success.main' : 'error.main'}>
                      {formatCurrency(channel.totalProfit)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {channel.lastTradeAt ? new Date(channel.lastTradeAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => handleView(channel.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && channels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography align="center" color="text.secondary">
                      {error || 'No channels found.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
          <Typography variant="body2">Page {page} of {totalPages}</Typography>
          <Box>
            <Button variant="outlined" size="small" onClick={() => handleChangePage(page - 1)} disabled={page <= 1} sx={{ mr: 1 }}>
              Previous
            </Button>
            <Button variant="outlined" size="small" onClick={() => handleChangePage(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </Box>
        </Box>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      <Drawer anchor="right" open={detailOpen} onClose={() => setDetailOpen(false)} PaperProps={{ sx: { width: 420, p: 3 } }}>
        {detailLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {!detailLoading && selectedChannel && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>{selectedChannel.channel.name}</Typography>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {selectedChannel.channel.type} • Mode: {selectedChannel.channel.mode}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Total Trades</Typography>
                <Typography variant="h6">{selectedChannel.stats.totalTrades.toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Win Rate</Typography>
                <Typography variant="h6">{formatPercent(selectedChannel.stats.winRate)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Total Profit</Typography>
                <Typography variant="h6" color={selectedChannel.stats.totalProfit >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(selectedChannel.stats.totalProfit)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Avg. Profit</Typography>
                <Typography variant="h6">{formatCurrency(selectedChannel.stats.avgProfit)}</Typography>
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>Top Traders</Typography>
            <List dense>
              {selectedChannel.leaderBoard.map(leader => (
                <ListItem key={leader.id} disablePadding>
                  <ListItemText
                    primary={leader.author}
                    secondary={`Signals: ${leader.totalSignals} • Win ${formatPercent(leader.winRate)} • Avg ${formatCurrency(leader.avgProfitLoss)}`}
                  />
                </ListItem>
              ))}
              {selectedChannel.leaderBoard.length === 0 && (
                <Typography variant="body2" color="text.secondary">No trader stats yet.</Typography>
              )}
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>Recent Trades</Typography>
            <List dense>
              {selectedChannel.recentTrades.map(trade => (
                <ListItem key={trade.id} disablePadding>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{trade.symbol} {trade.action}</span>
                        <Tooltip title="Profit / Loss">
                          <Typography color={(trade.profitLoss || 0) >= 0 ? 'success.main' : 'error.main'}>
                            {formatCurrency(trade.profitLoss || 0)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    }
                    secondary={new Date(trade.createdAt).toLocaleString()}
                  />
                </ListItem>
              ))}
              {selectedChannel.recentTrades.length === 0 && (
                <Typography variant="body2" color="text.secondary">No recent trades.</Typography>
              )}
            </List>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default ChannelsPage;
