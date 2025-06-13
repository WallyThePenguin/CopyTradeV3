import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Box,
  Paper
} from '@mui/material';

export interface TraderInfo {
  channelId: string;
  name?: string;
  autoCopy: boolean;
  mode: 'manual' | 'score';
  winRate: number;
  avgReturn: number;
  tradeCount: number;
  score: number;
  active?: boolean;
}

interface Props {
  traders: TraderInfo[];
  onToggleAutoCopy: (id: string, enabled: boolean) => void;
  onChangeMode: (id: string, mode: 'manual' | 'score') => void;
}

const TradersTable: React.FC<Props> = ({ traders, onToggleAutoCopy, onChangeMode }) => (
  <TableContainer component={Paper}>
    <Typography variant="h6" gutterBottom>
      Trader Channels
    </Typography>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Trader</TableCell>
          <TableCell align="center">Auto-Copy</TableCell>
          <TableCell align="center">Mode</TableCell>
          <TableCell align="center">Win Rate</TableCell>
          <TableCell align="center">Avg Return</TableCell>
          <TableCell align="center">Trades</TableCell>
          <TableCell align="center">Score</TableCell>
          <TableCell align="center">Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {traders.map((tr) => (
          <TableRow key={tr.channelId}>
            <TableCell>{tr.name || tr.channelId}</TableCell>
            <TableCell align="center">
              <Switch checked={tr.autoCopy} onChange={(e) => onToggleAutoCopy(tr.channelId, e.target.checked)} />
            </TableCell>
            <TableCell align="center">
              <FormControl size="small" variant="standard">
                <InputLabel id={`mode-label-${tr.channelId}`}>Mode</InputLabel>
                <Select
                  labelId={`mode-label-${tr.channelId}`}
                  value={tr.mode}
                  onChange={(e) => onChangeMode(tr.channelId, e.target.value as 'manual' | 'score')}
                  label="Mode"
                >
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="score">Score</MenuItem>
                </Select>
              </FormControl>
            </TableCell>
            <TableCell align="center">{(tr.winRate * 100).toFixed(1)}%</TableCell>
            <TableCell align="center">{(tr.avgReturn * 100).toFixed(1)}%</TableCell>
            <TableCell align="center">{tr.tradeCount}</TableCell>
            <TableCell align="center">{tr.score.toFixed(2)}</TableCell>
            <TableCell align="center">
              {tr.active ? <Chip label="Active" color="success" size="small" /> : <Box component="span" sx={{ color: '#888' }}>–</Box>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default TradersTable;
