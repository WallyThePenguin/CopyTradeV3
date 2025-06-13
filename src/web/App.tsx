import React, { useEffect, useState } from 'react';
import { Container, Grid, Snackbar } from '@mui/material';
import TradersTable, { TraderInfo } from './TradersTable';
import TradeLogTable, { TradeRecord } from './TradeLog';
import ApproveTradeModal, { TradeSignal } from './ApproveTradeModal';

const WS_URL = (() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
})();

const App: React.FC = () => {
  const [traders, setTraders] = useState<TraderInfo[]>([]);
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>([]);
  const [activeTrades, setActiveTrades] = useState<TradeRecord[]>([]);
  const [pending, setPending] = useState<TradeSignal[]>([]);
  const [modal, setModal] = useState<TradeSignal | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resTr = await fetch('/api/channels');
        const tdata = await resTr.json();
        setTraders(tdata);
        const resTrades = await fetch('/api/order-records');
        const log = await resTrades.json();
        setTradeLog(log);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load initial data');
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
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
          default:
            break;
        }
      } catch (err) {
        console.error('WS err', err);
      }
    };
    return () => {
      ws.close();
    };
  }, [modal]);

  const handleToggleAutoCopy = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/channels/${id}/auto-copy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      setTraders((p) => p.map((t) => (t.channelId === id ? { ...t, autoCopy: enabled } : t)));
    } catch {
      setErrorMsg('Failed to update auto-copy');
    }
  };

  const handleChangeMode = async (id: string, mode: 'manual' | 'score') => {
    try {
      await fetch(`/api/channels/${id}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      setTraders((p) => p.map((t) => (t.channelId === id ? { ...t, mode } : t)));
    } catch {
      setErrorMsg('Failed to update mode');
    }
  };

  const handleApprove = async (trade: TradeSignal) => {
    try {
      await fetch(`/api/trades/${trade.tradeId}/approve`, { method: 'POST' });
    } catch {
      setErrorMsg('Failed to approve trade');
    }
    setModal(null);
  };

  const handleReject = async (trade: TradeSignal) => {
    try {
      await fetch(`/api/trades/${trade.tradeId}/reject`, { method: 'POST' });
    } catch {
      console.warn('reject failed');
    }
    setModal(null);
  };

  return (
    <Container sx={{ py: 4 }} maxWidth="xl">
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <TradersTable traders={traders} onToggleAutoCopy={handleToggleAutoCopy} onChangeMode={handleChangeMode} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TradeLogTable trades={tradeLog} />
        </Grid>
      </Grid>

      {modal && (
        <ApproveTradeModal trade={modal} onApprove={handleApprove} onReject={handleReject} onClose={() => setModal(null)} />
      )}

      <Snackbar open={!!errorMsg} message={errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg(null)} />
    </Container>
  );
};

export default App;
