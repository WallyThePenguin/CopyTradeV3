import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Paper } from '@mui/material';

export interface TradeRecord {
  tradeId: string;
  channelId: string;
  channelName?: string;
  symbol?: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  durationSec?: number;
}

interface Props {
  trades: TradeRecord[];
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

const TradeLogTable: React.FC<Props> = ({ trades }) => (
  <TableContainer component={Paper}>
    <Typography variant="h6" gutterBottom>Trade Log</Typography>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Channel</TableCell>
          <TableCell>Entry Time</TableCell>
          <TableCell>Entry Price</TableCell>
          <TableCell>Exit Time</TableCell>
          <TableCell>Exit Price</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell>Return %</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {trades.map((tr) => (
          <TableRow key={tr.tradeId}>
            <TableCell>{tr.channelName || tr.channelId}</TableCell>
            <TableCell>{formatTime(tr.entryTime)}</TableCell>
            <TableCell>${tr.entryPrice.toFixed(2)}</TableCell>
            <TableCell>{formatTime(tr.exitTime)}</TableCell>
            <TableCell>${tr.exitPrice.toFixed(2)}</TableCell>
            <TableCell>{formatDuration(tr.durationSec)}</TableCell>
            <TableCell>{(tr.returnPct * 100).toFixed(2)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default TradeLogTable;
