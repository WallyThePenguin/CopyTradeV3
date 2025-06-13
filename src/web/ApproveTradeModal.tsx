import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

export interface TradeSignal {
  tradeId: string;
  channelId: string;
  channelName?: string;
  symbol: string;
  entryPrice: number;
  entryTime: string;
}

interface Props {
  trade: TradeSignal;
  onApprove: (t: TradeSignal) => void;
  onReject: (t: TradeSignal) => void;
  onClose: () => void;
}

const ApproveTradeModal: React.FC<Props> = ({ trade, onApprove, onReject, onClose }) => (
  <Dialog open onClose={onClose}>
    <DialogTitle>Approve Trade</DialogTitle>
    <DialogContent dividers>
      <Typography gutterBottom>
        <strong>Trader:</strong> {trade.channelName || trade.channelId}
      </Typography>
      <Typography gutterBottom>
        <strong>Symbol:</strong> {trade.symbol}
      </Typography>
      <Typography gutterBottom>
        <strong>Entry Price:</strong> ${trade.entryPrice.toFixed(2)}
      </Typography>
      <Typography gutterBottom>
        <strong>Time:</strong> {new Date(trade.entryTime).toLocaleString()}
      </Typography>
      <Typography sx={{ mt: 2 }}>
        This trader is set to <em>manual mode</em>. Approve this trade?
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => onReject(trade)} color="secondary">
        Reject
      </Button>
      <Button onClick={() => onApprove(trade)} variant="contained" color="primary">
        Approve
      </Button>
    </DialogActions>
  </Dialog>
);

export default ApproveTradeModal;
