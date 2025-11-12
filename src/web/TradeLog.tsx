import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Paper, Box, Button, Chip } from '@mui/material';

export interface TradeRecord {
  tradeId: string;
  channelId: string;
  channelName?: string;
  symbol?: string;
  optionType?: string;
  strikePrice?: number;
  expirationDate?: string;
  status?: string;
  mode?: string;
  calloutId?: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  durationSec?: number;
}

interface Props {
  trades: TradeRecord[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const formatDuration = (sec?: number) => {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatContract = (trade: TradeRecord) => {
  if (!trade.symbol) return '—';
  if (!trade.optionType) return trade.symbol;
  const strike = typeof trade.strikePrice === 'number' ? ` ${trade.strikePrice}` : '';
  const type = trade.optionType?.toUpperCase().startsWith('P') ? 'P' : 'C';
  const expiry = trade.expirationDate ? ` (${new Date(trade.expirationDate).toLocaleDateString()})` : '';
  return `${trade.symbol}${strike}${type}${expiry}`;
};

const TradeLogTable: React.FC<Props> = ({ trades, currentPage, totalPages, onPageChange }) => {
  const safeTrades = Array.isArray(trades) ? trades : [];
  return (
    <TableContainer component={Paper}>
      <Typography variant="h6" gutterBottom>Trade Log</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Contract</TableCell>
            <TableCell>Channel</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Entry Time</TableCell>
            <TableCell>Entry Price</TableCell>
            <TableCell>Exit Time</TableCell>
            <TableCell>Exit Price</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Return %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {safeTrades.map((tr) => (
            <TableRow key={tr.tradeId}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatContract(tr)}
                </Typography>
              </TableCell>
              <TableCell>{tr.channelName || tr.channelId}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={tr.status || 'UNKNOWN'}
                  color={tr.status === 'CLOSED' ? 'success' : tr.status === 'OPEN' ? 'warning' : 'default'}
                />
              </TableCell>
              <TableCell>{formatTime(tr.entryTime)}</TableCell>
              <TableCell>${typeof tr.entryPrice === 'number' && !isNaN(tr.entryPrice) ? tr.entryPrice.toFixed(2) : '0.00'}</TableCell>
              <TableCell>{formatTime(tr.exitTime)}</TableCell>
              <TableCell>${typeof tr.exitPrice === 'number' && !isNaN(tr.exitPrice) ? tr.exitPrice.toFixed(2) : '0.00'}</TableCell>
              <TableCell>{formatDuration(tr.durationSec)}</TableCell>
              <TableCell>{typeof tr.returnPct === 'number' && !isNaN(tr.returnPct) ? tr.returnPct.toFixed(2) : '0.00'}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          sx={{ mr: 2 }}
        >
          Previous
        </Button>
        <Typography variant="body2" sx={{ mx: 2 }}>
          Page {currentPage} of {totalPages}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          sx={{ ml: 2 }}
        >
          Next
        </Button>
      </Box>
    </TableContainer>
  );
};

export default TradeLogTable;
