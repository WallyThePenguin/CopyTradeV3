import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box
} from '@mui/material';

export interface CalloutMatch {
  id: string;
  quoteSource?: string;
  referencePrice?: number;
  markPrice?: number;
  bidPrice?: number;
  askPrice?: number;
  quoteTimestamp?: string;
}

export interface CalloutRecord {
  id: string;
  symbol: string;
  action?: string;
  optionType?: string;
  strikePrice?: number;
  expirationDate?: string;
  targetEntry?: number;
  status: string;
  confidence?: number;
  channelName?: string;
  calloutAt: string;
  matchedAt?: string;
  matches?: CalloutMatch[];
  tradeId?: string;
  tradeStatus?: string;
}

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING: 'warning',
  MATCHED: 'info',
  FILLED: 'success',
  CLOSED: 'default'
};

const formatTimestamp = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

const formatContract = (callout: CalloutRecord) => {
  if (!callout.symbol) return '—';
  if (!callout.optionType) return callout.symbol;
  const strike = callout.strikePrice ? `${callout.strikePrice}` : '';
  const opt = callout.optionType?.toUpperCase().startsWith('P') ? 'P' : 'C';
  const expiry = callout.expirationDate ? ` (${new Date(callout.expirationDate).toLocaleDateString()})` : '';
  return `${callout.symbol} ${strike}${opt}${expiry}`;
};

const latestMatchSummary = (callout: CalloutRecord) => {
  if (!callout.matches?.length) return { priceText: '—', timestamp: '—', source: '' };
  const latest = callout.matches[0];
  const price =
    latest.markPrice ??
    latest.referencePrice ??
    latest.bidPrice ??
    latest.askPrice;
  return {
    priceText: typeof price === 'number' ? `$${price.toFixed(2)}` : '—',
    timestamp: formatTimestamp(latest.quoteTimestamp),
    source: latest.quoteSource || ''
  };
};

interface Props {
  callouts: CalloutRecord[];
}

const CalloutsPanel: React.FC<Props> = ({ callouts }) => {
  const rows = Array.isArray(callouts) ? callouts.slice(0, 15) : [];
  return (
    <Paper sx={{ p: 2, overflowX: 'auto' }}>
      <Typography variant="h6" gutterBottom>Recent Callouts</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Channel</TableCell>
            <TableCell>Contract</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Target Entry</TableCell>
            <TableCell>Last Price</TableCell>
            <TableCell>Quote Source</TableCell>
            <TableCell>Callout Time</TableCell>
            <TableCell>Last Update</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(callout => {
            const latest = latestMatchSummary(callout);
            const chipColor = statusColors[callout.status?.toUpperCase()] || 'default';
            return (
              <TableRow key={callout.id}>
                <TableCell>{callout.channelName || 'Unknown'}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatContract(callout)}
                  </Typography>
                  {callout.action && (
                    <Typography variant="caption" color="text.secondary">
                      {callout.action}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={callout.status || 'UNKNOWN'}
                    size="small"
                    color={chipColor}
                  />
                </TableCell>
                <TableCell>
                  {typeof callout.targetEntry === 'number' ? `$${callout.targetEntry.toFixed(2)}` : '—'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2">{latest.priceText}</Typography>
                    <Typography variant="caption" color="text.secondary">{latest.timestamp}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{latest.source || '—'}</TableCell>
                <TableCell>{formatTimestamp(callout.calloutAt)}</TableCell>
                <TableCell>{formatTimestamp(callout.matchedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          No callouts captured yet.
        </Typography>
      )}
    </Paper>
  );
};

export default CalloutsPanel;
