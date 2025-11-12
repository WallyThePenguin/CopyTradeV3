import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemText
} from '@mui/material';

interface UserSummary {
  id: string;
  author: string;
  channelId: string;
  channelName: string;
  totalSignals: number;
  successfulSignals: number;
  avgConfidence: number;
  avgProfitLoss: number;
  winRate: number;
  lastActive: string;
  bestSymbols: Array<{ symbol: string; winRate: number; totalTrades: number }>;
}

interface UserDetail {
  user: UserSummary & { bestSymbols: string };
  winRate: number;
  recentTrades: TradeRecord[];
}

interface TradeRecord {
  id: string;
  symbol: string;
  action: string;
  profitLoss: number | null;
  createdAt: string;
}

const pageSize = 10;

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchUsers = async (nextPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users?page=${nextPage}&limit=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      const parsedUsers = (data.users || []).map((u: any) => ({
        ...u,
        bestSymbols: Array.isArray(u.bestSymbols) ? u.bestSymbols : []
      }));
      setUsers(parsedUsers);
      setPage(data.currentPage || 1);
      setTotalPages(data.pages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openUserDetail = async (userId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch user stats');
      const data = await res.json();
      setSelectedUser({
        ...data,
        recentTrades: data.recentTrades || []
      });
      setDetailOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load user stats');
      setSelectedUser(null);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleChangePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    fetchUsers(nextPage);
  };

  return (
    <Box sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Users</Typography>
          <Typography color="text.secondary" variant="body2">
            Trader performance across monitored channels.
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trader</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell align="right">Signals</TableCell>
              <TableCell align="right">Win Rate</TableCell>
              <TableCell align="right">Avg. Confidence</TableCell>
              <TableCell align="right">Avg. P/L</TableCell>
              <TableCell>Last Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{user.author}</Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={user.channelName || user.channelId} />
                </TableCell>
                <TableCell align="right">{user.totalSignals}</TableCell>
                <TableCell align="right">{user.winRate.toFixed(1)}%</TableCell>
                <TableCell align="right">{(user.avgConfidence || 0).toFixed(2)}</TableCell>
                <TableCell align="right">
                  <Typography color={user.avgProfitLoss >= 0 ? 'success.main' : 'error.main'}>
                    ${user.avgProfitLoss.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>{new Date(user.lastActive).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => openUserDetail(user.id)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography align="center" color="text.secondary">
                    {error || 'No users found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
          <Typography variant="body2">Page {page} of {totalPages}</Typography>
          <Box>
            <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => handleChangePage(page - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="outlined" size="small" onClick={() => handleChangePage(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </Box>
        </Box>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      <Drawer anchor="right" open={detailOpen} onClose={() => setDetailOpen(false)} PaperProps={{ sx: { width: 420, p: 3 } }}>
        {detailLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {!detailLoading && selectedUser && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>{selectedUser.user.author}</Typography>
            <Typography variant="subtitle2" color="text.secondary">
              Channel: {selectedUser.user.channelName || selectedUser.user.channelId}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Signals</Typography>
                <Typography variant="h6">{selectedUser.user.totalSignals}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Win Rate</Typography>
                <Typography variant="h6">{selectedUser.winRate.toFixed(1)}%</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Avg. Profit</Typography>
                <Typography variant="h6">${selectedUser.user.avgProfitLoss.toFixed(2)}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>Recent Trades</Typography>
            <List dense>
              {selectedUser.recentTrades.map(trade => (
                <ListItem key={trade.id} disablePadding>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{trade.symbol} {trade.action}</span>
                        <Typography color={(trade.profitLoss || 0) >= 0 ? 'success.main' : 'error.main'}>
                          ${(trade.profitLoss || 0).toFixed(2)}
                        </Typography>
                      </Box>
                    }
                    secondary={new Date(trade.createdAt).toLocaleString()}
                  />
                </ListItem>
              ))}
              {selectedUser.recentTrades.length === 0 && (
                <Typography variant="body2" color="text.secondary">No recent trades for this user.</Typography>
              )}
            </List>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default UsersPage;
